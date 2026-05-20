/**
 * Unified Scheduler
 *
 * Main orchestrator for the cron-based automation scheduler.
 * Replaces the 4 hardcoded cron routes with a single unified flow
 * that reads per-automation `trigger_config` to determine schedule,
 * targets, and deduplication behavior.
 *
 * Supports trigger types:
 * - system.scheduled
 * - system.check_in_reminder
 * - system.pre_arrival_reminder
 * - system.check_out_reminder
 *
 * Flow:
 * 1. Fetch all active properties
 * 2. For each property, fetch matching automations
 * 3. For each automation: parse config → evaluate cron → resolve targets → dedupe → run pipeline
 * 4. Return summary
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getAutomationWithDetails } from '../queries'
import { evaluateConditions } from '../condition-evaluator'
import { executePipeline } from '../pipeline'
import { createActionRegistry, type ActionHandlerMap } from '../action-registry'
import { logAutomationExecution } from '../execution-logger'
import type { TriggerType, EventContext, ScheduledTriggerConfig } from '../types'
import type { MatchedAutomation } from '../trigger-matcher'
import { ScheduledTriggerConfigSchema } from '../schemas'
import { evaluateCron, getTimezoneOffset } from './cron-evaluator'
import { resolveTargets, type ResolvedTarget } from './target-resolver'
import { getAlreadyProcessedEntityIds } from './dedupe'
import { buildEntityContext } from './entity-context-builder'

export interface SchedulerRunResult {
  totalAutomations: number
  dueAutomations: number
  totalEntities: number
  processedEntities: number
  skippedDuplicates: number
  errors: number
}

/** Trigger types handled by the unified scheduler */
const SCHEDULER_TRIGGER_TYPES: TriggerType[] = [
  'system.scheduled',
  'system.check_in_reminder',
  'system.pre_arrival_reminder',
  'system.check_out_reminder',
]

// Singleton registry (created once per cold start)
let registry: ActionHandlerMap | null = null

function getRegistry(): ActionHandlerMap {
  if (!registry) {
    registry = createActionRegistry()
  }
  return registry
}

/**
 * Run the unified scheduler.
 *
 * Called from the cron route handler. Processes all active properties
 * and their scheduled automations.
 */
export async function runUnifiedScheduler(): Promise<SchedulerRunResult> {
  const result: SchedulerRunResult = {
    totalAutomations: 0,
    dueAutomations: 0,
    totalEntities: 0,
    processedEntities: 0,
    skippedDuplicates: 0,
    errors: 0,
  }

  const supabase = createServiceRoleClient()

  // 1. Fetch all active properties
  const { data: properties, error: propsError } = await supabase
    .from('properties')
    .select('id, company_id, name')
    .eq('status', 'active')

  if (propsError) {
    console.error('[Unified Scheduler] Failed to fetch properties:', propsError)
    throw propsError
  }

  if (!properties || properties.length === 0) {
    console.log('[Unified Scheduler] No active properties found')
    return result
  }

  console.log(`[Unified Scheduler] Processing ${properties.length} active properties`)

  // 2. For each property
  for (const property of properties) {
    const propertyId = property.id
    const companyId = property.company_id

    if (!companyId) {
      console.warn(`[Unified Scheduler] Skipping property ${propertyId} — no company_id`)
      continue
    }

    try {
      await processProperty(propertyId, companyId, property.name, supabase, result)
    } catch (err) {
      console.error(`[Unified Scheduler] Fatal error processing property ${propertyId}:`, err)
      result.errors++
    }
  }

  console.log(
    `[Unified Scheduler] Complete: ${result.totalAutomations} automations, ` +
    `${result.dueAutomations} due, ${result.totalEntities} entities, ` +
    `${result.processedEntities} processed, ${result.skippedDuplicates} deduplicated, ` +
    `${result.errors} errors`,
  )

  return result
}

/**
 * Process all scheduled automations for a single property.
 */
async function processProperty(
  propertyId: string,
  companyId: string,
  propertyName: string,
  supabase: ReturnType<typeof createServiceRoleClient>,
  result: SchedulerRunResult,
): Promise<void> {
  // Fetch both property-scoped AND system-scoped automations in one query
  const orParts = [
    `property_id.eq.${propertyId}`,
    `and(property_id.is.null,company_id.eq.${companyId})`,
  ]

  const { data: automations, error: autError } = await supabase
    .from('automations')
    .select('*')
    .or(orParts.join(','))
    .eq('is_active', true)
    .in('trigger_type', SCHEDULER_TRIGGER_TYPES)

  if (autError) {
    console.error(`[Unified Scheduler] Failed to fetch automations for property ${propertyId}:`, autError)
    result.errors++
    return
  }

  const allAutomations = automations ?? []

  if (allAutomations.length === 0) {
    return
  }

  result.totalAutomations += allAutomations.length

  for (const automation of allAutomations) {
    try {
      await processAutomation(automation, propertyId, companyId, propertyName, supabase, result)
    } catch (err) {
      console.error(
        `[Unified Scheduler] Error processing automation ${automation.id} "${automation.name}":`,
        err,
      )
      result.errors++
    }
  }
}

/**
 * Process a single automation: parse config → evaluate cron → resolve targets → dedupe → run.
 */
async function processAutomation(
  automation: Record<string, unknown>,
  propertyId: string,
  companyId: string,
  propertyName: string,
  supabase: ReturnType<typeof createServiceRoleClient>,
  result: SchedulerRunResult,
): Promise<void> {
  const automationId = automation.id as string
  const triggerType = automation.trigger_type as TriggerType
  const triggerConfig = automation.trigger_config as Record<string, unknown> | undefined
  // Determine if this is a system-scoped automation (property_id = null)
  const isSystemAutomation = automation.property_id === null

  // Parse trigger_config with Zod schema
  const parseResult = ScheduledTriggerConfigSchema.safeParse(triggerConfig ?? {})

  if (!parseResult.success) {
    // Expected for legacy automations with empty trigger_config {}
    console.warn(
      `[Unified Scheduler] Skipping automation ${automationId} "${automation.name}" — ` +
      `invalid trigger_config: ${parseResult.error.message}`,
    )
    return
  }

  const config = parseResult.data as ScheduledTriggerConfig

  // Evaluate cron expression against current time (with timezone offset)
  const now = new Date()
  let evalTime: Date

  try {
    const offsetMinutes = getTimezoneOffset(config.timezone, now)
    // Shift the evaluation time so the cron evaluator (which works in UTC)
    // sees the "local" time for the configured timezone
    evalTime = new Date(now.getTime() + offsetMinutes * 60 * 1000)
  } catch (err) {
    console.warn(
      `[Unified Scheduler] Invalid timezone "${config.timezone}" for automation ${automationId}, using UTC`,
    )
    evalTime = now
  }

  let cronResult: { isDue: boolean; humanReadable: string }
  try {
    cronResult = evaluateCron(config.schedule, evalTime)
  } catch (err) {
    console.error(
      `[Unified Scheduler] Invalid cron "${config.schedule}" for automation ${automationId}:`,
      err,
    )
    return
  }

  if (!cronResult.isDue) {
    return
  }

  result.dueAutomations++
  console.log(
    `[Unified Scheduler] Automation "${automation.name}" (${automationId}) is due: ${cronResult.humanReadable}`,
  )

  // Resolve target entities
  const targets = await resolveTargets(config, propertyId, companyId, supabase)

  if (targets.length === 0) {
    return
  }

  result.totalEntities += targets.length

  // Deduplicate — for system automations, use null propertyId in dedupe query
  const dedupePropertyId = isSystemAutomation ? null : propertyId
  const alreadyProcessed = await getAlreadyProcessedEntityIds({
    automationId,
    propertyId: dedupePropertyId,
    entityType: config.target === 'property' ? 'property' : config.target.slice(0, -1), // reservations → reservation
    dedupeWindow: config.dedupeWindow,
    supabase,
  })

  // Load full automation details (conditions, actions, branches) once
  const details = await getAutomationWithDetails(automationId)
  if (!details) {
    console.error(
      `[Unified Scheduler] Failed to load details for automation ${automationId}`,
    )
    result.errors++
    return
  }

  const matchedAutomation: MatchedAutomation = {
    automation: details.automation,
    conditionGroups: details.conditionGroups,
    conditions: details.conditions,
    actions: details.actions,
    branches: details.branches,
  }

  // Process each non-duplicate entity
  for (const target of targets) {
    if (alreadyProcessed.has(target.entityId)) {
      result.skippedDuplicates++
      continue
    }

    try {
      // Build EventContext
      const context = await buildEntityContext({
        target,
        config,
        propertyId,
        companyId,
        supabase,
      })

      // Override event.type with the actual trigger type
      context.event.type = triggerType

      // Evaluate conditions for this specific automation
      const rootGroups = matchedAutomation.conditionGroups.filter(
        (g) => g.parent_group_id === null,
      )
      const conditionsPassed = evaluateConditions(
        rootGroups,
        matchedAutomation.conditionGroups,
        matchedAutomation.conditions,
        context,
      )

      if (conditionsPassed) {
        // Execute pipeline for just this single automation
        const actionRegistry = getRegistry()
        const pipelineStart = Date.now()
        const pipelineResult = await executePipeline(
          [matchedAutomation],
          context,
          actionRegistry,
        )
        const pipelineDuration = Date.now() - pipelineStart

        // Log execution
        await logAutomationExecution(
          matchedAutomation.automation,
          context,
          pipelineResult,
          true,
          pipelineDuration,
        )

        // Count executed actions
        let executedCount = 0
        for (const [, phaseResult] of pipelineResult.phaseResults) {
          executedCount += phaseResult.results.filter(
            (r) => r.status === 'executed',
          ).length
        }

        result.processedEntities++

        console.log(
          `[Unified Scheduler] Entity ${target.entityId}: executed=${executedCount}`,
        )
      } else {
        // Log that conditions didn't pass
        await logAutomationExecution(
          matchedAutomation.automation,
          context,
          {
            totalDurationMs: 0,
            terminalGuardFired: false,
            phasesSkipped: [],
            phaseResults: new Map(),
          },
          false,
          0,
        )

        console.log(
          `[Unified Scheduler] Entity ${target.entityId}: conditions not met`,
        )
      }
    } catch (err) {
      console.error(
        `[Unified Scheduler] Pipeline failed for entity ${target.entityId}:`,
        err,
      )
      result.errors++
    }
  }
}

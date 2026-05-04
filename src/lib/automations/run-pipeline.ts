/**
 * Direct Pipeline Invocation
 *
 * Runs the automation pipeline for a synthetic trigger.
 * Used by cron routes where no in-memory EventBus subscriber exists.
 *
 * Flow: match automations → evaluate conditions → execute pipeline → log
 */

import type { TriggerType, EventContext } from './types'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { matchAutomations, type MatchedAutomation } from './trigger-matcher'
import { evaluateConditions } from './condition-evaluator'
import { executePipeline } from './pipeline'
import { createActionRegistry, type ActionHandlerMap } from './action-registry'
import { logAutomationExecution } from './execution-logger'
import { getLogger } from '@/shared/infrastructure/logging'

// Singleton registry (created once per cold start)
let registry: ActionHandlerMap | null = null

function getRegistry(): ActionHandlerMap {
  if (!registry) {
    registry = createActionRegistry()
  }
  return registry
}

export interface PipelineRunSummary {
  matched: number
  passed: number
  executed: number
}

/**
 * Trigger automations for a reservation event.
 * Builds the event context from the DB by reservationId, then runs the pipeline.
 *
 * This is the PRIMARY mechanism for firing automations — used directly from
 * API routes instead of relying on the in-memory EventBus (which can have
 * different module instances in dev/Turbopack).
 */
export async function triggerReservationAutomations(
  triggerType: TriggerType,
  reservationId: string,
  propertyId: string,
  companyId: string,
): Promise<PipelineRunSummary | null> {
  console.log(`[Automation Pipeline] Triggering: ${triggerType} for reservation ${reservationId}`)

  try {
    // 1. Build event context from DB
    const context = await buildReservationEventContext(
      triggerType,
      reservationId,
      propertyId,
      companyId,
    )

    // 2. Run the pipeline
    const result = await runPipelineForTrigger(triggerType, propertyId, companyId, context)

    console.log(`[Automation Pipeline] Completed: ${triggerType} for reservation ${reservationId}`, {
      matched: result.matched,
      passed: result.passed,
      executed: result.executed,
    })

    return result
  } catch (err) {
    console.error(
      `[Automation Pipeline] Failed: ${triggerType} for reservation ${reservationId}`,
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

/**
 * Build an EventContext from a reservation ID by fetching related entities.
 */
async function buildReservationEventContext(
  triggerType: TriggerType,
  reservationId: string,
  propertyId: string,
  companyId: string,
): Promise<EventContext> {
  const supabase = createServiceRoleClient()

  const context: EventContext = {
    event: {
      type: triggerType,
      timestamp: new Date(),
    },
    propertyId,
    companyId,
  }

  try {
    // Fetch reservation
    const { data: reservation } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()
    if (reservation) context.reservation = reservation as Record<string, unknown>

    // Fetch guest
    const guestId = (reservation as Record<string, unknown> | null)?.guest_id as string | undefined
    if (guestId) {
      const { data: guest } = await supabase
        .from('guests')
        .select('*')
        .eq('id', guestId)
        .single()
      if (guest) context.guest = guest as Record<string, unknown>
    }

    // Fetch property
    const { data: property } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single()
    if (property) context.property = property as Record<string, unknown>

    // Fetch site
    const siteId = (reservation as Record<string, unknown> | null)?.site_id as string | undefined
    if (siteId) {
      const { data: site } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single()
      if (site) context.site = site as Record<string, unknown>
    }

    // Always fetch the latest transaction for this reservation so all
    // trigger types (including cancellation) have payment context.
    const { data: latestTransaction } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestTransaction) {
      context.payment = latestTransaction as Record<string, unknown>
    } else {
      // Fallback: legacy payments table
      const { data: legacyPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (legacyPayment) context.payment = legacyPayment as Record<string, unknown>
    }

    // For cancellation, also look for a refund transaction
    if (triggerType === 'reservation.cancelled') {
      const { data: refundTransaction } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('reservation_id', reservationId)
        .eq('type', 'refund')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (refundTransaction) {
        context.payment = refundTransaction as Record<string, unknown>
        ;(context.payment as Record<string, unknown>).refund_status = refundTransaction.status || 'processing'
      } else {
        context.payment = (context.payment || {}) as Record<string, unknown>
        ;(context.payment as Record<string, unknown>).refund_status = 'none'
      }
    }
  } catch (err) {
    console.error(
      '[Automation Pipeline] buildReservationEventContext enrichment failed',
      err instanceof Error ? err.message : String(err),
    )
  }

  return context
}

/**
 * Run the automation pipeline directly for a synthetic trigger.
 *
 * Matches the same flow as subscriber.ts but without an EventBus:
 * 1. Match automations for this trigger + property + company
 * 2. Evaluate conditions (filter to passing automations)
 * 3. Execute pipeline for passing automations
 * 4. Log execution results for all evaluated automations
 */
export async function runPipelineForTrigger(
  triggerType: TriggerType,
  propertyId: string,
  companyId: string,
  context: EventContext,
): Promise<PipelineRunSummary> {
  const logger = getLogger()

  // 1. Match automations for this trigger + property
  const matched = await matchAutomations(triggerType, propertyId, companyId)

  if (matched.length === 0) {
    return { matched: 0, passed: 0, executed: 0 }
  }

  // 2. Evaluate conditions — filter to only passing automations
  const passingAutomations: MatchedAutomation[] = []
  const evaluationResults: Array<{ ma: MatchedAutomation; passed: boolean }> = []

  for (const ma of matched) {
    const rootGroups = ma.conditionGroups.filter((g) => g.parent_group_id === null)
    const passed = evaluateConditions(
      rootGroups,
      ma.conditionGroups,
      ma.conditions,
      context,
    )
    evaluationResults.push({ ma, passed })
    if (passed) {
      passingAutomations.push(ma)
    }
  }

  if (passingAutomations.length === 0) {
    // Log evaluation results for non-passing automations
    for (const { ma, passed } of evaluationResults) {
      try {
        await logAutomationExecution(
          ma.automation,
          context,
          {
            totalDurationMs: 0,
            terminalGuardFired: false,
            phasesSkipped: [],
            phaseResults: new Map(),
          },
          passed,
          0,
        )
      } catch (logErr) {
        logger.error('[Automations] Failed to log execution', {
          automationId: ma.automation.id,
          error: logErr instanceof Error ? logErr.message : String(logErr),
        })
      }
    }

    return { matched: matched.length, passed: 0, executed: 0 }
  }

  // 3. Execute pipeline for passing automations
  const actionRegistry = getRegistry()
  const pipelineStart = Date.now()
  const pipelineResult = await executePipeline(passingAutomations, context, actionRegistry)
  const pipelineDuration = Date.now() - pipelineStart

  // 4. Log results for ALL evaluated automations (passing and non-passing)
  for (const { ma, passed } of evaluationResults) {
    try {
      await logAutomationExecution(
        ma.automation,
        context,
        pipelineResult,
        passed,
        pipelineDuration,
      )
    } catch (logErr) {
      logger.error('[Automations] Failed to log execution', {
        automationId: ma.automation.id,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      })
    }
  }

  // Count total actions executed across all phase results
  let totalActionsExecuted = 0
  for (const [, phaseResult] of pipelineResult.phaseResults) {
    totalActionsExecuted += phaseResult.results.filter(
      (r) => r.status === 'executed',
    ).length
  }

  return {
    matched: matched.length,
    passed: passingAutomations.length,
    executed: totalActionsExecuted,
  }
}

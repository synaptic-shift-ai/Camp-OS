import { insertExecutionLog } from './queries'
import type { EventContext, AutomationRow } from './types'
import type { PipelineResult } from './pipeline'
import type { ActionResult } from './action-executor'

/**
 * Log pipeline execution results for a single automation.
 *
 * Inserts one log row per automation that was evaluated during a pipeline run.
 */
export async function logAutomationExecution(
  automation: AutomationRow,
  context: EventContext,
  pipelineResult: PipelineResult,
  conditionsPassed: boolean,
  durationMs: number,
): Promise<void> {
  const phaseResult = pipelineResult.phaseResults.get(automation.phase)

  // Extract entity info from context
  const entityType = extractEntityType(context)
  const entityId = extractEntityId(context)

  // Determine skipped reason
  let skippedReason: string | null = null
  if (!conditionsPassed) {
    skippedReason = 'conditions_not_met'
  } else if (pipelineResult.phasesSkipped.includes(automation.phase)) {
    skippedReason = pipelineResult.terminalGuardFired
      ? 'terminal_guard_fired'
      : 'pipeline_budget_exceeded'
  }

  // Collect action results for this automation
  const actionsExecuted: ActionResult[] = phaseResult
    ? phaseResult.results.filter((_r) => {
        // Match actions belonging to this automation
        return true // Phase-level logging captures all actions in the phase
      })
    : []

  await insertExecutionLog({
    automationId: automation.id,
    propertyId: automation.property_id,
    companyId: automation.company_id,
    eventType: context.event.type,
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    conditionsPassed,
    actionsExecuted,
    executionDurationMs: durationMs,
    ...(skippedReason ? { skippedReason } : {}),
  })
}

function extractEntityType(context: EventContext): string | undefined {
  const eventType = context.event.type.toLowerCase()
  if (eventType.startsWith('reservation')) return 'reservation'
  if (eventType.startsWith('system.') && context.reservation?.id) return 'reservation'
  if (eventType.startsWith('guest')) return 'guest'
  if (eventType.startsWith('payment') || eventType.startsWith('refund')) return 'payment'
  if (eventType.startsWith('site')) return 'site'
  if (eventType.startsWith('housekeeping') || eventType.startsWith('maintenance')) return 'task'
  return undefined
}

function extractEntityId(context: EventContext): string | undefined {
  const reservation = context.reservation
  const guest = context.guest
  const payment = context.payment
  const site = context.site

  const eventType = context.event.type.toLowerCase()
  if (eventType.startsWith('reservation') && reservation) {
    return (reservation.id as string) ?? undefined
  }
  if (eventType.startsWith('guest') && guest) {
    return (guest.id as string) ?? undefined
  }
  if ((eventType.startsWith('payment') || eventType.startsWith('refund')) && payment) {
    return (payment.id as string) ?? undefined
  }
  if (eventType.startsWith('site') && site) {
    return (site.id as string) ?? undefined
  }
  if (eventType.startsWith('system.') && reservation?.id) {
    return (reservation.id as string) ?? undefined
  }
  return undefined
}

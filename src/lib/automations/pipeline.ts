import type {
  EventContext,
  AutomationPhase,
} from './types'
import type { MatchedAutomation } from './trigger-matcher'
import { PHASE_ORDER } from './types'
import { executePhaseActions, type PhaseResult } from './action-executor'
import type { ActionHandlerMap } from './action-registry'
import { evaluateConditions } from './condition-evaluator'

export interface PipelineResult {
  totalDurationMs: number
  terminalGuardFired: boolean
  phasesSkipped: AutomationPhase[]
  phaseResults: Map<AutomationPhase, PhaseResult>
  error?: string
}

const TOTAL_BUDGET_MS = 2000

// Phases that are skipped when a terminal guard fires
const GUARD_SKIP_PHASES: AutomationPhase[] = ['PRICE', 'ENFORCE', 'OPERATE']

// Phases that always execute regardless of terminal guard
const ALWAYS_RUN_PHASES: AutomationPhase[] = ['COMMUNICATE', 'LOG']

/**
 * Execute the full 6-phase pipeline for matched automations.
 *
 * - GUARD phase: if any guard automation has is_terminal=true and its conditions pass,
 *   skip PRICE, ENFORCE, OPERATE phases.
 * - COMMUNICATE and LOG always execute.
 * - Total budget: 2s. If exceeded, skip remaining sync phases (still run COMMUNICATE + LOG).
 * - Fail-open: phase errors never block subsequent phases.
 */
export async function executePipeline(
  matchedAutomations: MatchedAutomation[],
  context: EventContext,
  registry: ActionHandlerMap,
): Promise<PipelineResult> {
  const pipelineStart = Date.now()
  const phaseResults = new Map<AutomationPhase, PhaseResult>()
  const phasesSkipped: AutomationPhase[] = []
  let terminalGuardFired = false

  // Group automations by phase
  const byPhase = new Map<AutomationPhase, MatchedAutomation[]>()
  for (const ma of matchedAutomations) {
    const phase = ma.automation.phase
    const list = byPhase.get(phase) ?? []
    list.push(ma)
    byPhase.set(phase, list)
  }

  // Check GUARD phase for terminal guards
  const guardAutomations = byPhase.get('GUARD') ?? []
  for (const guard of guardAutomations) {
    const rootGroups = guard.conditionGroups.filter((g) => g.parent_group_id === null)
    const passed = evaluateConditions(
      rootGroups,
      guard.conditionGroups,
      guard.conditions,
      context,
    )
    if (passed && guard.automation.is_terminal) {
      terminalGuardFired = true
      break
    }
  }

  // Execute phases in order
  for (const phase of PHASE_ORDER) {
    const elapsed = Date.now() - pipelineStart

    // Skip PRICE/ENFORCE/OPERATE if terminal guard fired
    if (terminalGuardFired && GUARD_SKIP_PHASES.includes(phase)) {
      phasesSkipped.push(phase)
      continue
    }

    // Budget check: if over budget and this isn't an always-run phase, skip
    if (elapsed >= TOTAL_BUDGET_MS && !ALWAYS_RUN_PHASES.includes(phase)) {
      phasesSkipped.push(phase)
      continue
    }

    const phaseAutomations = byPhase.get(phase)
    if (!phaseAutomations || phaseAutomations.length === 0) {
      // No automations for this phase — still check budget for always-run phases
      if (ALWAYS_RUN_PHASES.includes(phase) && elapsed < TOTAL_BUDGET_MS) {
        // No-op: no automations to run for this phase
      }
      continue
    }

    // Collect all actions/branches/conditions across automations in this phase
    const allActions = phaseAutomations.flatMap((ma) => ma.actions)
    const allBranches = phaseAutomations.flatMap((ma) => ma.branches)
    const allConditionGroups = phaseAutomations.flatMap((ma) => ma.conditionGroups)
    const allConditions = phaseAutomations.flatMap((ma) => ma.conditions)

    // For GUARD phase, only run actions for automations whose conditions pass
    let actionsToRun = allActions
    let branchesToRun = allBranches
    let groupsToRun = allConditionGroups
    let condsToRun = allConditions

    if (phase === 'GUARD') {
      // Filter to automations whose conditions pass
      const passingAutomationIds = new Set<string>()
      for (const ma of phaseAutomations) {
        const rootGroups = ma.conditionGroups.filter((g) => g.parent_group_id === null)
        const passed = evaluateConditions(
          rootGroups,
          ma.conditionGroups,
          ma.conditions,
          context,
        )
        if (passed) {
          passingAutomationIds.add(ma.automation.id)
        }
      }

      actionsToRun = allActions.filter((a) =>
        passingAutomationIds.has(a.automation_id),
      )
      branchesToRun = allBranches.filter((b) =>
        passingAutomationIds.has(b.automation_id),
      )
      groupsToRun = allConditionGroups.filter((g) =>
        passingAutomationIds.has(g.automation_id),
      )
      condsToRun = allConditions.filter((c) =>
        passingAutomationIds.has(c.automation_id),
      )
    }

    try {
      const result = await executePhaseActions(
        actionsToRun,
        branchesToRun,
        groupsToRun,
        condsToRun,
        registry,
        context,
      )
      result.phase = phase
      phaseResults.set(phase, result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Automations] Phase ${phase} error:`, message)
      phaseResults.set(phase, {
        phase,
        results: [],
        durationMs: Date.now() - pipelineStart,
        timedOut: false,
      })
    }
  }

  return {
    totalDurationMs: Date.now() - pipelineStart,
    terminalGuardFired,
    phasesSkipped,
    phaseResults,
  }
}

import type {
  AutomationActionRow,
  AutomationBranchRow,
  AutomationConditionGroupRow,
  AutomationConditionRow,
  EventContext,
} from './types'
import type { ActionHandlerMap } from './action-registry'
import { evaluateConditions } from './condition-evaluator'

export interface ActionResult {
  actionId: string
  status: 'executed' | 'skipped' | 'failed'
  error?: string
}

export interface PhaseResult {
  phase: string
  results: ActionResult[]
  durationMs: number
  timedOut: boolean
}

/**
 * Execute all actions for a phase (ordered by sort_order).
 *
 * - Fail-open: if an action fails, log and continue to the next.
 * - Phase timeout: if duration exceeds maxDurationMs, stop executing remaining actions.
 * - Supports branching: if an action has associated branches, evaluate the branch
 *   condition and execute the matching branch's sub-actions.
 */
export async function executePhaseActions(
  actions: AutomationActionRow[],
  branches: AutomationBranchRow[],
  conditionGroups: AutomationConditionGroupRow[],
  conditions: AutomationConditionRow[],
  registry: ActionHandlerMap,
  context: EventContext,
  maxDurationMs: number = 500,
): Promise<PhaseResult> {
  const start = Date.now()
  const results: ActionResult[] = []
  let timedOut = false

  // Root-level actions (no branch_id)
  const rootActions = actions
    .filter((a) => !a.branch_id)
    .sort((a, b) => a.sort_order - b.sort_order)

  for (const action of rootActions) {
    const elapsed = Date.now() - start
    if (elapsed >= maxDurationMs) {
      timedOut = true
      results.push({ actionId: action.id, status: 'skipped', error: 'Phase timeout' })
      continue
    }

    // Check for branches on this action
    const actionBranches = branches.filter((b) => b.parent_action_id === action.id)

    if (actionBranches.length > 0) {
      // Evaluate branches: find matching branch, execute its sub-actions
      for (const branch of actionBranches) {
        const branchActions = actions
          .filter((a) => a.branch_id === branch.id)
          .sort((a, b) => a.sort_order - b.sort_order)

        // For THEN branches, evaluate conditions on the automation to decide
        // For ELSE branches, execute if no THEN branch matched
        if (branch.branch_type === 'THEN') {
          // Evaluate conditions for the THEN branch using condition groups
          const rootGroups = conditionGroups.filter((g) => g.parent_group_id === null)
          const conditionsPass = evaluateConditions(
            rootGroups,
            conditionGroups,
            conditions,
            context,
          )

          if (conditionsPass) {
            for (const subAction of branchActions) {
              const subResult = await executeAction(subAction, registry, context)
              results.push(subResult)
            }
          }
        }
        // ELSE branches are executed only if no THEN branch actions were executed
        // We track that below
      }

      // Check if any THEN branch actions were executed
      const thenBranches = actionBranches.filter((b) => b.branch_type === 'THEN')
      const thenBranchActionIds = new Set(
        thenBranches.flatMap((b) =>
          actions.filter((a) => a.branch_id === b.id).map((a) => a.id),
        ),
      )
      const thenExecuted = results.some(
        (r) => thenBranchActionIds.has(r.actionId) && r.status === 'executed',
      )

      // Execute ELSE branch sub-actions only if no THEN branch matched
      if (!thenExecuted) {
        const elseBranches = actionBranches.filter((b) => b.branch_type === 'ELSE')
        for (const branch of elseBranches) {
          const elseActions = actions
            .filter((a) => a.branch_id === branch.id)
            .sort((a, b) => a.sort_order - b.sort_order)

          for (const subAction of elseActions) {
            const subResult = await executeAction(subAction, registry, context)
            results.push(subResult)
          }
        }
      }

      // Record the parent action as executed (branch dispatch)
      results.push({ actionId: action.id, status: 'executed' })
    } else {
      // No branches — execute directly
      const result = await executeAction(action, registry, context)
      results.push(result)
    }
  }

  return {
    phase: '',
    results,
    durationMs: Date.now() - start,
    timedOut,
  }
}

async function executeAction(
  action: AutomationActionRow,
  registry: ActionHandlerMap,
  context: EventContext,
): Promise<ActionResult> {
  const handler = registry.get(action.action_type)

  if (!handler) {
    return {
      actionId: action.id,
      status: 'failed',
      error: `No handler registered for action type: ${action.action_type}`,
    }
  }

  try {
    await handler.execute(action.action_config, context)
    return { actionId: action.id, status: 'executed' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Automations] Action ${action.id} (${action.action_type}) failed:`, message)
    return { actionId: action.id, status: 'failed', error: message }
  }
}

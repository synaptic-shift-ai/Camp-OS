/**
 * Trigger Matcher
 *
 * Matches incoming domain events to active automations.
 * Returns automations ordered by phase execution order then sort_order.
 */

import { findActiveAutomationsByTrigger, getAutomationWithDetails } from './queries'
import type {
  AutomationRow,
  AutomationConditionGroupRow,
  AutomationConditionRow,
  AutomationActionRow,
  AutomationBranchRow,
} from './types'
import { PHASE_ORDER } from './types'

export interface MatchedAutomation {
  automation: AutomationRow
  conditionGroups: AutomationConditionGroupRow[]
  conditions: AutomationConditionRow[]
  actions: AutomationActionRow[]
  branches: AutomationBranchRow[]
}

/**
 * Match an incoming event to active automations.
 * Returns automations ordered by phase execution order, then sort_order.
 */
export async function matchAutomations(
  triggerType: string,
  propertyId: string,
  companyId?: string
): Promise<MatchedAutomation[]> {
  // 1. Find active automations matching the trigger
  const automationRows = await findActiveAutomationsByTrigger(triggerType, propertyId, companyId)

  if (automationRows.length === 0) return []

  // 2. Sort by phase order, then sort_order
  const sorted = [...automationRows].sort((a, b) => {
    const phaseA = PHASE_ORDER.indexOf(a.phase)
    const phaseB = PHASE_ORDER.indexOf(b.phase)
    if (phaseA !== phaseB) return phaseA - phaseB
    return a.sort_order - b.sort_order
  })

  // 3. Load full details for each automation
  const results: MatchedAutomation[] = []

  for (const automation of sorted) {
    const details = await getAutomationWithDetails(automation.id)
    if (details) {
      results.push({
        automation: details.automation,
        conditionGroups: details.conditionGroups,
        conditions: details.conditions,
        actions: details.actions,
        branches: details.branches,
      })
    }
  }

  return results
}

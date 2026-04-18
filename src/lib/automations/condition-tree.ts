/**
 * Condition Tree Utilities
 *
 * Convert between nested UI state (ConditionGroupNode tree)
 * and flat API format (parentGroupIndex references).
 */

import type { LogicOperator, ConditionOperator } from '@/lib/automations/types'

// ============================================================================
// UI State Types (nested tree)
// ============================================================================

export interface ConditionNode {
  id: string
  variable: string
  operator: ConditionOperator
  value: unknown
}

export interface ConditionGroupNode {
  id: string
  logicOperator: LogicOperator
  conditions: ConditionNode[]
  children: ConditionGroupNode[]
}

// ============================================================================
// API Format Types (flat array with index references)
// ============================================================================

export interface FlatConditionGroup {
  logicOperator: LogicOperator
  parentGroupIndex?: number
  conditions: Array<{
    variable: string
    operator: ConditionOperator
    value: unknown
  }>
}

// ============================================================================
// Flatten: nested tree → flat API format
// ============================================================================

export function flattenTree(groups: ConditionGroupNode[]): FlatConditionGroup[] {
  const flat: FlatConditionGroup[] = []

  function walk(group: ConditionGroupNode, parentFlatIndex?: number) {
    const currentIndex = flat.length
    flat.push({
      logicOperator: group.logicOperator,
      conditions: group.conditions.map(c => ({
        variable: c.variable,
        operator: c.operator,
        value: c.value,
      })),
      ...(parentFlatIndex !== undefined ? { parentGroupIndex: parentFlatIndex } : {}),
    })

    for (const child of group.children) {
      walk(child, currentIndex)
    }
  }

  for (const group of groups) {
    walk(group, undefined)
  }

  return flat
}

// ============================================================================
// Hydrate: flat API format → nested tree
// ============================================================================

export interface FlatGroupRow {
  id: string
  logic_operator: LogicOperator
  parent_group_id: string | null
  sort_order: number
}

export interface FlatConditionRow {
  id: string
  group_id: string
  variable: string
  operator: ConditionOperator
  value: unknown
  sort_order: number
}

export function hydrateTree(
  groups: FlatGroupRow[],
  conditions: FlatConditionRow[]
): ConditionGroupNode[] {
  // Build id → group map
  const groupMap = new Map<string, FlatGroupRow>()
  for (const g of groups) groupMap.set(g.id, g)

  // Build parent → children map
  const childrenMap = new Map<string | null, string[]>()
  for (const g of groups) {
    const parentId = g.parent_group_id
    const existing = childrenMap.get(parentId) ?? []
    existing.push(g.id)
    childrenMap.set(parentId, existing)
  }

  // Build group → conditions map
  const conditionsMap = new Map<string, ConditionNode[]>()
  for (const c of conditions) {
    const existing = conditionsMap.get(c.group_id) ?? []
    existing.push({
      id: c.id,
      variable: c.variable,
      operator: c.operator,
      value: c.value,
    })
    conditionsMap.set(c.group_id, existing)
  }

  // Recursively build tree
  function buildNode(groupId: string): ConditionGroupNode {
    const g = groupMap.get(groupId)!
    const condNodes = conditionsMap.get(groupId) ?? []

    const childGroupIds = childrenMap.get(groupId) ?? []
    const childNodes = childGroupIds.map(id => buildNode(id))

    return {
      id: groupId,
      logicOperator: g.logic_operator,
      conditions: condNodes,
      children: childNodes,
    }
  }

  // Root groups have parent_group_id === null
  const rootIds = childrenMap.get(null) ?? []
  return rootIds.map(id => buildNode(id)).sort(
    (a, b) => {
      const ga = groupMap.get(a.id)!
      const gb = groupMap.get(b.id)!
      return ga.sort_order - gb.sort_order
    }
  )
}

// ============================================================================
// Helpers
// ============================================================================

export function createEmptyGroup(logicOperator: LogicOperator = 'AND'): ConditionGroupNode {
  return {
    id: crypto.randomUUID(),
    logicOperator,
    conditions: [],
    children: [],
  }
}

export function createEmptyCondition(): ConditionNode {
  return {
    id: crypto.randomUUID(),
    variable: 'reservation.status',
    operator: 'IS',
    value: '',
  }
}

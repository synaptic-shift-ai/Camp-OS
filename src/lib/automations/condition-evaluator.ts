/**
 * Condition Evaluator
 *
 * Evaluates the condition tree for an automation against an EventContext.
 * Supports nested AND/OR groups with a max recursion depth of 10.
 */

import type {
  EventContext,
  AutomationConditionGroupRow,
  AutomationConditionRow,
  ConditionOperator,
  LogicOperator,
} from './types'

const MAX_DEPTH = 10

/**
 * Evaluate the full condition tree for an automation.
 * Root groups (parent_group_id IS NULL) are combined with AND logic.
 */
export function evaluateConditions(
  rootGroups: AutomationConditionGroupRow[],
  allGroups: AutomationConditionGroupRow[],
  conditions: AutomationConditionRow[],
  eventContext: EventContext
): boolean {
  if (rootGroups.length === 0) return true

  return rootGroups.every((group) =>
    evaluateGroup(group, allGroups, conditions, eventContext, 0)
  )
}

/**
 * Evaluate a single condition group (recursive).
 * Gets child groups and conditions for this group, evaluates
 * children with the group's logic_operator.
 */
function evaluateGroup(
  group: AutomationConditionGroupRow,
  allGroups: AutomationConditionGroupRow[],
  conditions: AutomationConditionRow[],
  eventContext: EventContext,
  depth: number
): boolean {
  if (depth > MAX_DEPTH) {
    console.error('[automations] evaluateGroup exceeded max depth', {
      groupId: group.id,
      depth,
    })
    return false
  }

  const childGroups = allGroups.filter((g) => g.parent_group_id === group.id)
  const groupConditions = conditions
    .filter((c) => c.group_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order)

  const results: boolean[] = []

  // Evaluate child conditions
  for (const condition of groupConditions) {
    results.push(evaluateCondition(condition, eventContext))
  }

  // Recursively evaluate child groups
  for (const childGroup of childGroups) {
    results.push(
      evaluateGroup(childGroup, allGroups, conditions, eventContext, depth + 1)
    )
  }

  if (results.length === 0) return true

  // Apply group's logic operator
  if (group.logic_operator === 'AND') {
    return results.every(Boolean)
  }
  return results.some(Boolean)
}

/**
 * Evaluate a single condition against event context.
 * If the variable cannot be resolved, returns false (never throws).
 */
function evaluateCondition(
  condition: AutomationConditionRow,
  eventContext: EventContext
): boolean {
  const actual = resolveVariable(condition.variable, eventContext)
  if (actual === undefined) return false

  return applyOperator(
    condition.operator as ConditionOperator,
    actual,
    condition.value
  )
}

/**
 * Resolve a dotted path variable from event context.
 * e.g. "reservation.status" → context.reservation?.status
 *      "event.type" → context.event.type
 */
function resolveVariable(path: string, context: EventContext): unknown {
  const parts = path.split('.')
  if (parts.length === 0) return undefined

  // Map top-level keys to context fields
  const topKey = parts[0]
  let current: unknown

  switch (topKey) {
    case 'event':
      current = context.event
      break
    case 'reservation':
      current = context.reservation
      break
    case 'guest':
      current = context.guest
      break
    case 'property':
      current = context.property
      break
    case 'site':
      current = context.site
      break
    case 'payment':
      current = context.payment
      break
    case 'housekeeping':
      current = context.property
      break
    default:
      return undefined
  }

  // Traverse remaining path segments
  for (let i = 1; i < parts.length; i++) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[parts[i]!]
  }

  return current
}

/**
 * Apply an operator comparison.
 */
function applyOperator(
  operator: ConditionOperator,
  actual: unknown,
  expected: unknown
): boolean {
  switch (operator) {
    case 'IS':
      return actual === expected

    case 'IS_NOT':
      return actual !== expected

    case 'GT':
      return toNumber(actual) > toNumber(expected)

    case 'LT':
      return toNumber(actual) < toNumber(expected)

    case 'GTE':
      return toNumber(actual) >= toNumber(expected)

    case 'LTE':
      return toNumber(actual) <= toNumber(expected)

    case 'BETWEEN': {
      const range = toArray(expected)
      if (range.length !== 2) return false
      const val = toNumber(actual)
      return val >= toNumber(range[0]) && val <= toNumber(range[1])
    }

    case 'BEFORE':
      return toDate(actual) < toDate(expected)

    case 'AFTER':
      return toDate(actual) > toDate(expected)

    case 'WITHIN_DATE_GROUP': {
      const obj = toObject(expected)
      if (!obj) return false
      const start = toDate(obj.startDate)
      const end = toDate(obj.endDate)
      const date = toDate(actual)
      return date >= start && date <= end
    }

    case 'CONTAINS': {
      if (Array.isArray(actual)) {
        return actual.some((item) => item === expected)
      }
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.includes(expected)
      }
      return false
    }

    case 'NOT_CONTAINS': {
      if (Array.isArray(actual)) {
        return !actual.some((item) => item === expected)
      }
      if (typeof actual === 'string' && typeof expected === 'string') {
        return !actual.includes(expected)
      }
      return true
    }

    case 'IS_TRUE':
      return Boolean(actual) === true

    case 'IS_FALSE':
      return Boolean(actual) === false

    default:
      return false
  }
}

// ============================================================================
// Coercion helpers
// ============================================================================

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  if (typeof value === 'boolean') return value ? 1 : 0
  return 0
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? new Date(0) : d
  }
  return new Date(0)
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return []
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

// ============================================================================
// Detailed condition evaluation (for dry-run)
// ============================================================================

export interface ConditionEvaluationResult {
  conditionId: string
  variable: string
  operator: ConditionOperator
  expected: unknown
  actual: unknown
  passed: boolean
}

export interface ConditionGroupEvaluationResult {
  groupId: string
  logicOperator: LogicOperator
  passed: boolean
  conditions: ConditionEvaluationResult[]
  childGroups: ConditionGroupEvaluationResult[]
}

export interface ConditionsEvaluationDetail {
  passed: boolean
  groups: ConditionGroupEvaluationResult[]
}

/**
 * Evaluate conditions with detailed per-condition results.
 * Same logic as evaluateConditions but returns pass/fail per condition.
 */
export function evaluateConditionsDetailed(
  rootGroups: AutomationConditionGroupRow[],
  allGroups: AutomationConditionGroupRow[],
  conditions: AutomationConditionRow[],
  eventContext: EventContext
): ConditionsEvaluationDetail {
  if (rootGroups.length === 0) {
    return { passed: true, groups: [] }
  }

  const groupResults = rootGroups.map((group) =>
    evaluateGroupDetailed(group, allGroups, conditions, eventContext, 0)
  )

  return {
    passed: groupResults.every((r) => r.passed),
    groups: groupResults,
  }
}

function evaluateGroupDetailed(
  group: AutomationConditionGroupRow,
  allGroups: AutomationConditionGroupRow[],
  conditions: AutomationConditionRow[],
  eventContext: EventContext,
  depth: number
): ConditionGroupEvaluationResult {
  if (depth > MAX_DEPTH) {
    return {
      groupId: group.id,
      logicOperator: group.logic_operator,
      passed: false,
      conditions: [],
      childGroups: [],
    }
  }

  const childGroups = allGroups.filter((g) => g.parent_group_id === group.id)
  const groupConditions = conditions
    .filter((c) => c.group_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order)

  const conditionResults: ConditionEvaluationResult[] = groupConditions.map(
    (condition) => {
      const actual = resolveVariable(condition.variable, eventContext)
      const passed =
        actual !== undefined &&
        applyOperator(
          condition.operator as ConditionOperator,
          actual,
          condition.value
        )
      return {
        conditionId: condition.id,
        variable: condition.variable,
        operator: condition.operator as ConditionOperator,
        expected: condition.value,
        actual,
        passed,
      }
    }
  )

  const childGroupResults = childGroups.map((child) =>
    evaluateGroupDetailed(child, allGroups, conditions, eventContext, depth + 1)
  )

  const allResults = [
    ...conditionResults.map((r) => r.passed),
    ...childGroupResults.map((r) => r.passed),
  ]

  let passed: boolean
  if (allResults.length === 0) {
    passed = true
  } else if (group.logic_operator === 'AND') {
    passed = allResults.every(Boolean)
  } else {
    passed = allResults.some(Boolean)
  }

  return {
    groupId: group.id,
    logicOperator: group.logic_operator,
    passed,
    conditions: conditionResults,
    childGroups: childGroupResults,
  }
}

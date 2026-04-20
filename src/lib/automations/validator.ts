/**
 * Automation Validator
 *
 * Cross-automation conflict analysis + per-automation checks.
 * Returns issues grouped by severity: error, warning, info.
 */

import type { AutomationRow, AutomationPhase } from './types'

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  severity: ValidationSeverity
  phase: AutomationPhase | null
  title: string
  description: string
  automationIds: string[]
  automationNames: string[]
}

export interface ValidationResult {
  issues: ValidationIssue[]
  summary: { errors: number; warnings: number; info: number }
  scannedAt: string
}

// ============================================================================
// Helpers
// ============================================================================

function formatList(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return `"${names[0]}"`
  if (names.length === 2) return `"${names[0]}" and "${names[1]}"`
  const last = names[names.length - 1]!
  const rest = names.slice(0, -1).map((n) => `"${n}"`).join(', ')
  return `${rest}, and "${last}"`
}

// Trigger types that the event bus actually publishes
const PUBLISHED_TRIGGERS: Set<string> = new Set([
  'reservation.created',
  'reservation.confirmed',
  'reservation.checked_in',
  'reservation.checked_out',
  'reservation.cancelled',
  'reservation.modified',
  'reservation.no_show',
  'payment.received',
  'refund.processed',
])

// ============================================================================
// Main validation function
// ============================================================================

export function validateAutomations(
  automations: AutomationRow[],
  automationDetails: Array<{
    automationId: string
    hasConditions: boolean
    hasActions: boolean
  }>
): ValidationResult {
  const issues: ValidationIssue[] = []

  // Build lookup map for details
  const detailsMap = new Map(automationDetails.map((d) => [d.automationId, d]))

  // ── Per-automation checks ──────────────────────────────────────────

  for (const a of automations) {
    const detail = detailsMap.get(a.id)

    // Invalid trigger type
    if (!PUBLISHED_TRIGGERS.has(a.trigger_type)) {
      issues.push({
        severity: 'error',
        phase: a.phase,
        title: 'Invalid Trigger',
        description: `"${a.name}" uses an unrecognized trigger type "${a.trigger_type}". This automation will never fire.`,
        automationIds: [a.id],
        automationNames: [a.name],
      })
    }

    // Active with no actions
    if (a.is_active && detail && !detail.hasActions) {
      issues.push({
        severity: 'error',
        phase: a.phase,
        title: 'No Actions',
        description: `"${a.name}" is active but has no actions configured. When conditions match, nothing will happen.`,
        automationIds: [a.id],
        automationNames: [a.name],
      })
    }

    // No conditions
    if (detail && !detail.hasConditions && PUBLISHED_TRIGGERS.has(a.trigger_type)) {
      issues.push({
        severity: 'warning',
        phase: a.phase,
        title: 'No Conditions',
        description: `"${a.name}" has no conditions. Every ${a.trigger_type} event will match and trigger this automation.`,
        automationIds: [a.id],
        automationNames: [a.name],
      })
    }
  }

  // ── Cross-automation checks ───────────────────────────────────────

  // Group by (phase, trigger_type) — only for active automations
  const activeAutomations = automations.filter((a) => a.is_active)
  const groups = new Map<string, AutomationRow[]>()
  for (const a of activeAutomations) {
    const key = `${a.phase}::${a.trigger_type}`
    const list = groups.get(key) ?? []
    list.push(a)
    groups.set(key, list)
  }

  for (const [key, group] of groups) {
    if (group.length < 2) continue

    const phase = group[0]!.phase
    const trigger = group[0]!.trigger_type

    // GUARD: same phase conflict
    if (phase === 'GUARD') {
      issues.push({
        severity: 'warning',
        phase,
        title: 'Same Phase Conflict',
        description: `${formatList(group.map((a) => a.name))} both run in Guard phase with the same trigger.`,
        automationIds: group.map((a) => a.id),
        automationNames: group.map((a) => a.name),
      })
    }
    // PRICE: potential contradiction
    else if (phase === 'PRICE') {
      issues.push({
        severity: 'info',
        phase,
        title: 'Potential Contradiction',
        description: `${formatList(group.map((a) => a.name))} both trigger on ${trigger} in Price phase. If both match, order determines final price.`,
        automationIds: group.map((a) => a.id),
        automationNames: group.map((a) => a.name),
      })
    }
  }

  // ── Sort: error → warning → info ──────────────────────────────────

  const severityOrder: Record<ValidationSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  }
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  const info = issues.filter((i) => i.severity === 'info').length

  return {
    issues,
    summary: { errors, warnings, info },
    scannedAt: new Date().toISOString(),
  }
}

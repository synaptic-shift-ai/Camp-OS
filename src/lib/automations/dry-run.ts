/**
 * Dry Run Engine
 *
 * Simulates how an automation would fire against historical entity data
 * (reservations, payments) without relying on the event store.
 * No side effects — no emails, no WOs, no ledger entries.
 *
 * Uses current DB state for context enrichment (documented as known limitation).
 */

import type { TriggerType, ActionType, EventContext } from './types'
import type { ConditionsEvaluationDetail } from './condition-evaluator'
import { evaluateConditionsDetailed } from './condition-evaluator'
import { buildEventContext } from './event-context'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type {
  AutomationRow,
  AutomationConditionGroupRow,
  AutomationConditionRow,
  AutomationActionRow,
  AutomationBranchRow,
} from './types'

// ============================================================================
// Types
// ============================================================================

export interface DryRunMatchedEvent {
  /** DB entity ID (reservation.id, payment.id, etc.) */
  entityId: string
  /** Display identifier (confirmation_number, etc.) */
  entityLabel: string
  /** When this event occurred (created_at, or status change date) */
  eventDate: string
  /** The trigger type being simulated */
  triggerType: TriggerType
  /** Whether conditions matched */
  matched: boolean
  /** Per-condition detail (only when matched or has conditions) */
  conditionsDetail?: ConditionsEvaluationDetail
  /** Actions that would execute (only when matched) */
  actionsWouldExecute?: Array<{
    actionId: string
    actionType: ActionType
    actionConfig: Record<string, unknown>
  }>
}

export interface DryRunResult {
  automationId: string
  automationName: string
  triggerType: TriggerType
  dateRange: { from: string; to: string }
  totalScanned: number
  matchedCount: number
  results: DryRunMatchedEvent[]
  durationMs: number
}

// ============================================================================
// Trigger → query config
// ============================================================================

type QueryConfig = {
  table: string
  dateColumn: string
  /** Additional WHERE clauses beyond date range */
  extraWhere?: string
  /** Column to use as entity label (e.g. confirmation_number) */
  labelColumn: string
}

const TRIGGER_QUERIES: Record<string, QueryConfig> = {
  'reservation.created': {
    table: 'reservations',
    dateColumn: 'created_at',
    labelColumn: 'confirmation_number',
  },
  'reservation.confirmed': {
    table: 'reservations',
    dateColumn: 'created_at',
    extraWhere: "status = 'confirmed'",
    labelColumn: 'confirmation_number',
  },
  'reservation.checked_in': {
    table: 'reservations',
    dateColumn: 'created_at',
    extraWhere: "status = 'checked_in'",
    labelColumn: 'confirmation_number',
  },
  'reservation.checked_out': {
    table: 'reservations',
    dateColumn: 'created_at',
    extraWhere: "status = 'checked_out'",
    labelColumn: 'confirmation_number',
  },
  'reservation.cancelled': {
    table: 'reservations',
    dateColumn: 'created_at',
    extraWhere: "status = 'cancelled'",
    labelColumn: 'confirmation_number',
  },
  'reservation.modified': {
    table: 'reservations',
    dateColumn: 'updated_at',
    labelColumn: 'confirmation_number',
  },
  'reservation.no_show': {
    table: 'reservations',
    dateColumn: 'created_at',
    extraWhere: "status = 'no_show'",
    labelColumn: 'confirmation_number',
  },
  'refund.processed': {
    table: 'payments',
    dateColumn: 'created_at',
    extraWhere: "payment_status = 'refunded'",
    labelColumn: 'id',
  },
}

// ============================================================================
// Main function
// ============================================================================

export async function dryRunAutomation(
  automationId: string,
  propertyId: string,
  dateRange: '7d' | '30d' | '90d' | { from: string; to: string },
  limit?: number
): Promise<DryRunResult> {
  const startMs = Date.now()
  const maxResults = Math.min(limit ?? 100, 500)

  // 1. Load automation with full details using service-role client to bypass RLS.
  //    The permission check has already been performed in the API route, so it is safe
  //    to use the service role here. This is required for system automations
  //    (property_id = null) which are not accessible via the user's RLS policies.
  const svc = createServiceRoleClient()

  const { data: automationRow, error: autError } = await svc
    .from('automations' as any)
    .select('*')
    .eq('id', automationId)
    .single()

  if (autError || !automationRow) {
    throw new Error(`Automation ${automationId} not found`)
  }

  const automation = automationRow as unknown as AutomationRow

  const [groupsRes, conditionsRes, actionsRes] = await Promise.all([
    svc.from('automation_condition_groups' as any).select('*').eq('automation_id', automationId).order('sort_order'),
    svc.from('automation_conditions' as any).select('*').eq('automation_id', automationId).order('sort_order'),
    svc.from('automation_actions' as any).select('*').eq('automation_id', automationId).order('sort_order'),
  ])

  const conditionGroups = (groupsRes.data ?? []) as unknown as AutomationConditionGroupRow[]
  const conditions = (conditionsRes.data ?? []) as unknown as AutomationConditionRow[]
  const actions = (actionsRes.data ?? []) as unknown as AutomationActionRow[]
  const triggerType = automation.trigger_type as TriggerType

  // 2. Compute date range
  const toDate = new Date()
  let fromDate: Date
  if (typeof dateRange === 'string') {
    const days = parseInt(dateRange)
    fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  } else {
    fromDate = new Date(dateRange.from)
  }

  // 3. Get query config for this trigger
  const queryConfig = TRIGGER_QUERIES[triggerType]
  if (!queryConfig) {
    return {
      automationId,
      automationName: automation.name,
      triggerType,
      dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
      totalScanned: 0,
      matchedCount: 0,
      results: [],
      durationMs: Date.now() - startMs,
    }
  }

  // 4. Query entities from DB
  const supabase = createServiceRoleClient()
  let query = supabase
    .from(queryConfig.table as any)
    .select('*')
    .eq('property_id', propertyId)
    .gte(queryConfig.dateColumn, fromDate.toISOString())
    .lte(queryConfig.dateColumn, toDate.toISOString())
    .order(queryConfig.dateColumn, { ascending: false })
    .limit(maxResults)

  if (queryConfig.extraWhere) {
    // Parse simple equality: "status = 'confirmed'" → col='status', val='confirmed'
    const eqMatch = queryConfig.extraWhere.match(/^(\w+)\s*=\s*'([^']+)'$/)
    if (eqMatch) {
      query = query.eq(eqMatch[1]!, eqMatch[2]!)
    }
  }

  const { data: entities, error: dbError } = await query
  if (dbError) {
    console.error('[dry-run] DB query failed', { table: queryConfig.table, error: dbError })
    return {
      automationId,
      automationName: automation.name,
      triggerType,
      dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
      totalScanned: 0,
      matchedCount: 0,
      results: [],
      durationMs: Date.now() - startMs,
    }
  }

  // Get root condition groups
  const rootGroups = conditionGroups.filter((g) => g.parent_group_id === null)

  // 5. Evaluate each entity
  const results: DryRunMatchedEvent[] = []
  const rows = (entities ?? []) as Array<Record<string, unknown>>

  for (const row of rows) {
    try {
      const entityLabel = (row[queryConfig.labelColumn] as string) ?? row.id ?? '—'
      const eventDate = (row[queryConfig.dateColumn] as string) ?? new Date().toISOString()

      // Build a fake event from the entity row so buildEventContext can resolve it
      const fakeEvent = {
        eventType: triggerType,
        occurredAt: new Date(eventDate),
        eventId: `dry-run-${row.id}`,
        toJSON: () => ({
          id: row.id,
          reservationId: row.id,
          propertyId: row.property_id,
          guestId: row.guest_id,
          siteId: row.site_id,
          paymentId: row.id,
          ...row,
        }),
      } as any

      const context = await buildEventContext(fakeEvent)

      // Evaluate conditions with detailed results
      const conditionsDetail = evaluateConditionsDetailed(
        rootGroups,
        conditionGroups,
        conditions,
        context
      )

      const actionsWouldExecute = conditionsDetail.passed
        ? actions.map((a) => ({
            actionId: a.id,
            actionType: a.action_type as ActionType,
            actionConfig: (a.action_config ?? {}) as Record<string, unknown>,
          }))
        : null

      results.push({
        entityId: row.id as string,
        entityLabel,
        eventDate,
        triggerType,
        matched: conditionsDetail.passed,
        conditionsDetail,
        ...(actionsWouldExecute ? { actionsWouldExecute } : {}),
      })
    } catch (err) {
      results.push({
        entityId: row.id as string,
        entityLabel: (row[queryConfig.labelColumn] as string) ?? '—',
        eventDate: (row[queryConfig.dateColumn] as string) ?? '',
        triggerType,
        matched: false,
      })
    }
  }

  const matchedCount = results.filter((r) => r.matched).length

  return {
    automationId,
    automationName: automation.name,
    triggerType,
    dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    totalScanned: results.length,
    matchedCount,
    results,
    durationMs: Date.now() - startMs,
  }
}

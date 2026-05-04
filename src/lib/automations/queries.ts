/**
 * Automation Queries
 *
 * Supabase query layer for the automations engine.
 * Single-record reads (getAutomationWithDetails) use the service-role client so that
 * system automations (property_id = null) are accessible regardless of RLS.
 * Permission checks are always done at the route/page level before these functions are called.
 * List reads use the user-context client; writes use service-role client.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type {
  AutomationRow,
  AutomationConditionGroupRow,
  AutomationConditionRow,
  AutomationActionRow,
  AutomationBranchRow,
  AutomationPhase,
  AutomationScope,
  TriggerType,
  ActionType,
  ConditionOperator,
  LogicOperator,
  DelayUnit,
} from './types'

// ============================================================================
// Read
// ============================================================================

/**
 * List automations for a property, optionally filtered.
 * Uses user-context client (RLS applies).
 */
export async function listAutomations(
  propertyId: string,
  filters?: {
    phase?: AutomationPhase
    scope?: AutomationScope
    isActive?: boolean
  },
  companyId?: string | null,
): Promise<AutomationRow[]> {
  const supabase = await createClient()

  // Fetch property-scoped automations
  let query = supabase
    .from('automations' as any)
    .select('*')
    .eq('property_id', propertyId)
    .order('sort_order', { ascending: true })

  if (filters?.phase) query = query.eq('phase', filters.phase)
  if (filters?.scope) query = query.eq('scope', filters.scope)
  if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive)

  const { data, error } = await query

  if (error) {
    console.error('[automations] listAutomations failed', { propertyId, error })
    throw error
  }

  let results = ((data ?? []) as unknown as AutomationRow[])

  // Also fetch system automations for the user's company and append
  let sysQuery = createServiceRoleClient()
    .from('automations' as any)
    .select('*')
    .is('property_id', null)
    .eq('scope', 'system')
    .eq('company_id', companyId!)
    .order('sort_order', { ascending: true })

  if (filters?.phase) sysQuery = sysQuery.eq('phase', filters.phase)
  if (filters?.isActive !== undefined) sysQuery = sysQuery.eq('is_active', filters.isActive)

  const { data: sysData, error: sysError } = await sysQuery
  if (sysError) {
    console.error('[automations] listAutomations system query failed', { error: sysError })
  } else {
    results = [...results, ...((sysData ?? []) as unknown as AutomationRow[])]
  }

  return results
}

/**
 * List system-scope automations (property_id IS NULL).
 * Uses service-role client since system automations have no property context.
 */
export async function listSystemAutomations(companyId: string): Promise<AutomationRow[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('automations' as any)
    .select('*')
    .is('property_id', null)
    .eq('scope', 'system')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[automations] listSystemAutomations failed', { error })
    throw error
  }

  return (data ?? []) as unknown as AutomationRow[]
}

/**
 */
export async function getAutomationWithDetails(automationId: string): Promise<{
  automation: AutomationRow
  conditionGroups: AutomationConditionGroupRow[]
  conditions: AutomationConditionRow[]
  actions: AutomationActionRow[]
  branches: AutomationBranchRow[]
} | null> {
  // Use service-role client so system automations (property_id = null) are accessible
  // regardless of user RLS policies. Permission checks happen at the route/page level.
  const supabase = createServiceRoleClient()

  const { data: automation, error: autError } = await supabase
    .from('automations' as any)
    .select('*')
    .eq('id', automationId)
    .single()

  if (autError || !automation) return null

  const aut = automation as unknown as AutomationRow

  const [groupsRes, conditionsRes, actionsRes, branchesRes] = await Promise.all([
    supabase.from('automation_condition_groups' as any).select('*').eq('automation_id', automationId).order('sort_order'),
    supabase.from('automation_conditions' as any).select('*').eq('automation_id', automationId).order('sort_order'),
    supabase.from('automation_actions' as any).select('*').eq('automation_id', automationId).order('sort_order'),
    supabase.from('automation_branches' as any).select('*').eq('automation_id', automationId),
  ])

  return {
    automation: aut,
    conditionGroups: (groupsRes.data ?? []) as unknown as AutomationConditionGroupRow[],
    conditions: (conditionsRes.data ?? []) as unknown as AutomationConditionRow[],
    actions: (actionsRes.data ?? []) as unknown as AutomationActionRow[],
    branches: (branchesRes.data ?? []) as unknown as AutomationBranchRow[],
  }
}

// ============================================================================
// Create
// ============================================================================

export interface CreateAutomationInput {
  companyId: string
  propertyId: string | null
  name: string
  description?: string
  phase: AutomationPhase
  scope?: AutomationScope
  isActive?: boolean
  isTerminal?: boolean
  triggerType: TriggerType
  triggerConfig?: Record<string, unknown>
  sortOrder?: number
  conditionGroups: Array<{
    logicOperator: LogicOperator
    parentGroupIndex?: number
    conditions: Array<{
      variable: string
      operator: ConditionOperator
      value: unknown
    }>
  }>
  actions: Array<{
    actionType: ActionType
    actionConfig?: Record<string, unknown>
    branchId?: string
    delayValue?: number
    delayUnit?: DelayUnit
    sortOrder: number
  }>
}

/**
 * Create automation with all child records.
 * Uses service-role client (bypasses RLS for engine writes).
 */
export async function createAutomationWithDetails(data: CreateAutomationInput): Promise<{
  automation: AutomationRow
  conditionGroups: AutomationConditionGroupRow[]
  conditions: AutomationConditionRow[]
  actions: AutomationActionRow[]
  branches: AutomationBranchRow[]
}> {
  const supabase = createServiceRoleClient()

  // 1. Insert automation row
  const { data: automation, error: autError } = await supabase
    .from('automations' as any)
    .insert({
      company_id: data.companyId,
      property_id: data.propertyId,
      name: data.name,
      description: data.description ?? null,
      phase: data.phase,
      scope: data.scope ?? 'property',
      is_active: data.isActive ?? false,
      is_terminal: data.isTerminal ?? false,
      trigger_type: data.triggerType,
      trigger_config: data.triggerConfig ?? {},
      sort_order: data.sortOrder ?? 0,
    })
    .select()
    .single()

  if (autError) {
    console.error('[automations] createAutomation failed', { error: autError })
    throw autError
  }

  const aut = automation as unknown as AutomationRow
  const automationId = aut.id

  // 2. Insert condition groups (resolve parentGroupIndex → parent_group_id)
  const groupInserts = data.conditionGroups.map((g, idx) => ({
    automation_id: automationId,
    parent_group_id: g.parentGroupIndex != null ? '__PENDING__' : null,
    logic_operator: g.logicOperator,
    sort_order: idx,
  }))

  const { data: groups, error: groupsError } = await supabase
    .from('automation_condition_groups' as any)
    .insert(groupInserts.length > 0 ? groupInserts : [])
    .select()

  if (groupsError) {
    console.error('[automations] createAutomation groups failed', { error: groupsError })
    throw groupsError
  }

  const groupRows = (groups ?? []) as unknown as AutomationConditionGroupRow[]

  // Patch parent_group_id references now that we have the group IDs
  const patches: Promise<unknown>[] = []
  data.conditionGroups.forEach((g, idx) => {
    if (g.parentGroupIndex != null && groupRows[idx]) {
      const parentId = groupRows[g.parentGroupIndex]?.id
      if (parentId) {
        patches.push(
          Promise.resolve(
            supabase
              .from('automation_condition_groups' as any)
              .update({ parent_group_id: parentId })
              .eq('id', groupRows[idx].id)
          )
        )
        groupRows[idx].parent_group_id = parentId
      }
    }
  })
  await Promise.all(patches)

  // 3. Insert conditions
  const conditionInserts = data.conditionGroups.flatMap((g, groupIdx) =>
    g.conditions.map((c, condIdx) => ({
      automation_id: automationId,
      group_id: groupRows[groupIdx]?.id,
      variable: c.variable,
      operator: c.operator,
      value: c.value,
      sort_order: condIdx,
    }))
  )

  const { data: conditions, error: condError } = await supabase
    .from('automation_conditions' as any)
    .insert(conditionInserts.length > 0 ? conditionInserts : [])
    .select()

  if (condError) {
    console.error('[automations] createAutomation conditions failed', { error: condError })
    throw condError
  }

  // 4. Insert actions
  const actionInserts = data.actions.map((a, idx) => ({
    automation_id: automationId,
    branch_id: a.branchId ?? null,
    action_type: a.actionType,
    action_config: a.actionConfig ?? {},
    delay_value: a.delayValue ?? null,
    delay_unit: a.delayUnit ?? null,
    sort_order: a.sortOrder ?? idx,
  }))

  const { data: actions, error: actionsError } = await supabase
    .from('automation_actions' as any)
    .insert(actionInserts.length > 0 ? actionInserts : [])
    .select()

  if (actionsError) {
    console.error('[automations] createAutomation actions failed', { error: actionsError })
    throw actionsError
  }

  const actionRows = (actions ?? []) as unknown as AutomationActionRow[]

  return {
    automation: aut,
    conditionGroups: groupRows,
    conditions: (conditions ?? []) as unknown as AutomationConditionRow[],
    actions: actionRows,
    branches: [] as AutomationBranchRow[], // branches created separately when chaining
  }
}

// ============================================================================
// Update
// ============================================================================

export interface UpdateAutomationInput {
  name?: string
  description?: string | null
  isActive?: boolean
  isTerminal?: boolean
  triggerType?: TriggerType
  triggerConfig?: Record<string, unknown>
  sortOrder?: number
  conditionGroups?: Array<{
    id?: string
    logicOperator: LogicOperator
    parentGroupIndex?: number
    conditions: Array<{
      variable: string
      operator: ConditionOperator
      value: unknown
    }>
  }>
  actions?: Array<{
    id?: string
    actionType: ActionType
    actionConfig?: Record<string, unknown>
    delayValue?: number
    delayUnit?: DelayUnit
    sortOrder: number
  }>
}

/**
 * Update automation and delete-and-recreate child records if provided.
 * Uses service-role client.
 */
export async function updateAutomationWithDetails(
  automationId: string,
  data: UpdateAutomationInput
): Promise<void> {
  const supabase = createServiceRoleClient()

  // 1. Update automation row
  const updateFields: Record<string, unknown> = {}
  if (data.name !== undefined) updateFields.name = data.name
  if (data.description !== undefined) updateFields.description = data.description
  if (data.isActive !== undefined) updateFields.is_active = data.isActive
  if (data.isTerminal !== undefined) updateFields.is_terminal = data.isTerminal
  if (data.triggerType !== undefined) updateFields.trigger_type = data.triggerType
  if (data.triggerConfig !== undefined) updateFields.trigger_config = data.triggerConfig
  if (data.sortOrder !== undefined) updateFields.sort_order = data.sortOrder

  if (Object.keys(updateFields).length > 0) {
    const { error: updateError } = await supabase
      .from('automations' as any)
      .update(updateFields)
      .eq('id', automationId)

    if (updateError) {
      console.error('[automations] updateAutomation failed', { automationId, error: updateError })
      throw updateError
    }
  }

  // 2. If conditionGroups provided, delete-and-recreate
  if (data.conditionGroups) {
    await Promise.all([
      supabase.from('automation_conditions' as any).delete().eq('automation_id', automationId),
      supabase.from('automation_condition_groups' as any).delete().eq('automation_id', automationId),
    ])

    const groupInserts = data.conditionGroups.map((g, idx) => ({
      automation_id: automationId,
      parent_group_id: null as string | null, // resolved below
      logic_operator: g.logicOperator,
      sort_order: idx,
    }))

    if (groupInserts.length > 0) {
      const { data: groups, error: groupsError } = await supabase
        .from('automation_condition_groups' as any)
        .insert(groupInserts)
        .select()

      if (groupsError) {
        console.error('[automations] updateAutomation groups failed', { error: groupsError })
        throw groupsError
      }

      const groupRows = (groups ?? []) as unknown as AutomationConditionGroupRow[]

      // Patch parent_group_id
      const patches: Promise<unknown>[] = []
      data.conditionGroups.forEach((g, idx) => {
        if (g.parentGroupIndex != null && groupRows[idx]) {
          const parentId = groupRows[g.parentGroupIndex]?.id
          if (parentId) {
            patches.push(
              Promise.resolve(
                supabase
                  .from('automation_condition_groups' as any)
                  .update({ parent_group_id: parentId })
                  .eq('id', groupRows[idx].id)
              )
            )
          }
        }
      })
      await Promise.all(patches)

      // Insert conditions
      const conditionInserts = data.conditionGroups.flatMap((g, groupIdx) =>
        g.conditions.map((c, condIdx) => ({
          automation_id: automationId,
          group_id: groupRows[groupIdx]?.id,
          variable: c.variable,
          operator: c.operator,
          value: c.value,
          sort_order: condIdx,
        }))
      )

      if (conditionInserts.length > 0) {
        const { error: condError } = await supabase
          .from('automation_conditions' as any)
          .insert(conditionInserts)

        if (condError) {
          console.error('[automations] updateAutomation conditions failed', { error: condError })
          throw condError
        }
      }
    }
  }

  // 3. If actions provided, delete-and-recreate
  if (data.actions) {
    // Delete branches first (FK dependency), then actions
    await supabase.from('automation_branches' as any).delete().eq('automation_id', automationId)
    await supabase.from('automation_actions' as any).delete().eq('automation_id', automationId)

    const actionInserts = data.actions.map((a, idx) => ({
      automation_id: automationId,
      branch_id: null as string | null,
      action_type: a.actionType,
      action_config: a.actionConfig ?? {},
      delay_value: a.delayValue ?? null,
      delay_unit: a.delayUnit ?? null,
      sort_order: a.sortOrder ?? idx,
    }))

    if (actionInserts.length > 0) {
      const { error: actionsError } = await supabase
        .from('automation_actions' as any)
        .insert(actionInserts)

      if (actionsError) {
        console.error('[automations] updateAutomation actions failed', { error: actionsError })
        throw actionsError
      }
    }
  }
}

// ============================================================================
// Delete
// ============================================================================

export async function deleteAutomation(automationId: string): Promise<void> {
  const supabase = createServiceRoleClient()

  // CASCADE on the FKs handles children, but delete in explicit order for safety
  await supabase.from('automation_conditions' as any).delete().eq('automation_id', automationId)
  await supabase.from('automation_condition_groups' as any).delete().eq('automation_id', automationId)
  await supabase.from('automation_branches' as any).delete().eq('automation_id', automationId)
  await supabase.from('automation_actions' as any).delete().eq('automation_id', automationId)
  await supabase.from('automations' as any).delete().eq('id', automationId)
}

// ============================================================================
// Reorder
// ============================================================================

export async function reorderAutomation(
  automationId: string,
  sortOrder: number
): Promise<void> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('automations' as any)
    .update({ sort_order: sortOrder })
    .eq('id', automationId)

  if (error) {
    console.error('[automations] reorderAutomation failed', { automationId, error })
    throw error
  }
}

// ============================================================================
// Execution Log
// ============================================================================

export async function insertExecutionLog(entry: {
  automationId: string | null
  propertyId: string | null
  companyId: string
  eventType: string
  entityType?: string
  entityId?: string
  conditionsPassed?: boolean
  actionsExecuted: Array<{
    actionId: string
    status: 'executed' | 'skipped' | 'failed'
    error?: string
  }>
  executionDurationMs?: number
  skippedReason?: string
}): Promise<void> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('automation_execution_log' as any)
    .insert({
      automation_id: entry.automationId,
      property_id: entry.propertyId,
      company_id: entry.companyId,
      event_type: entry.eventType,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      conditions_passed: entry.conditionsPassed ?? null,
      actions_executed: entry.actionsExecuted,
      execution_duration_ms: entry.executionDurationMs ?? null,
      skipped_reason: entry.skippedReason ?? null,
    })

  if (error) {
    console.error('[automations] insertExecutionLog failed', { error })
    throw error
  }
}

export type ExecutionLogSortColumn = 'created_at' | 'execution_duration_ms' | 'event_type'
export type ExecutionLogSortOrder = 'asc' | 'desc'

export interface ExecutionLogRow {
  id: string
  automation_id: string | null
  automation_name: string | null
  automation_scope: string | null
  property_id: string | null
  company_id: string
  event_type: string
  entity_type: string | null
  entity_id: string | null
  conditions_passed: boolean | null
  actions_executed: unknown[]
  execution_duration_ms: number | null
  skipped_reason: string | null
  created_at: string
}

const VALID_SORT_COLUMNS: readonly string[] = ['created_at', 'execution_duration_ms', 'event_type']

export async function listExecutionLogs(
  propertyId: string,
  filters?: {
    automationId?: string
    automationIds?: string[]
    outcome?: 'passed' | 'skipped' | 'failed'
    dateFrom?: string
    dateTo?: string
    search?: string
    sortBy?: ExecutionLogSortColumn
    sortOrder?: ExecutionLogSortOrder
    limit?: number
    offset?: number
    companyId?: string
  }
): Promise<{ logs: ExecutionLogRow[]; total: number }> {
  const supabase = createServiceRoleClient()

  const sortBy = VALID_SORT_COLUMNS.includes(filters?.sortBy ?? '')
    ? (filters?.sortBy as ExecutionLogSortColumn)
    : 'created_at'
  const sortOrder: ExecutionLogSortOrder = filters?.sortOrder === 'asc' || filters?.sortOrder === 'desc'
    ? filters.sortOrder
    : 'desc'

  // Include both property-scoped logs and system automation logs (property_id IS NULL)
  // scoped to the same company to prevent cross-company visibility
  let query = supabase
    .from('automation_execution_log' as any)
    .select('*', { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' })

  if (filters?.companyId) {
    // Use .or() to include both property-scoped and system-scoped logs within the same company
    query = query
      .eq('company_id', filters.companyId)
      .or(`property_id.eq.${propertyId},property_id.is.null`)
  } else {
    // Fallback: only property-scoped logs if companyId not provided
    query = query.eq('property_id', propertyId)
  }

  if (filters?.automationId) query = query.eq('automation_id', filters.automationId)
  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('created_at', filters.dateTo)
  if (filters?.search) {
    // Search by entity_type, entity_id, or automation name (via matching IDs)
    const orClauses = [`entity_type.ilike.%${filters.search}%`, `entity_id.ilike.%${filters.search}%`]
    if (filters.automationIds?.length) {
      orClauses.push(`automation_id.in.(${filters.automationIds.join(',')})`)
    }
    query = query.or(orClauses.join(','))
  } else if (filters?.automationIds?.length) {
    // No text search but automation IDs from name match
    query = query.in('automation_id', filters.automationIds)
  }

  // outcome filter: passed = conditions_passed true, skipped = skipped_reason not null, failed = conditions_passed false
  if (filters?.outcome === 'passed') {
    query = query.eq('conditions_passed', true)
  } else if (filters?.outcome === 'skipped') {
    query = query.not('skipped_reason', 'is', null)
  } else if (filters?.outcome === 'failed') {
    query = query.eq('conditions_passed', false)
  }

  if (filters?.limit) query = query.limit(filters.limit)
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1)

  const { data, count, error } = await query

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[automations] listExecutionLogs failed', JSON.stringify({ propertyId, error: { message: error.message, code: error.code, details: error.details, hint: error.hint } }, null, 2))
    throw error
  }

  // Post-fetch enrichment: batch-fetch automation names/scopes
  const automationIds = [...new Set((data ?? []).map((r: any) => r.automation_id).filter(Boolean))]

  const automationMap = new Map<string, { name: string; scope: string }>()
  if (automationIds.length > 0) {
    const { data: automations } = await supabase
      .from('automations' as any)
      .select('id, name, scope')
      .in('id', automationIds)

    for (const a of (automations ?? [])) {
      automationMap.set(a.id, { name: a.name, scope: a.scope })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs: ExecutionLogRow[] = (data ?? []).map((row: any) => {
    const auto = automationMap.get(row.automation_id)
    return {
      ...row,
      automation_name: auto?.name ?? (row.automation_id == null ? 'Summary' : null),
      automation_scope: auto?.scope ?? null,
    }
  })

  return {
    logs,
    total: count ?? 0,
  }
}

// ============================================================================
// Trigger Matcher Query
// ============================================================================

/**
 * Find active automations matching a trigger type for a property.
 * Uses service-role client (engine context, not user-context).
 */
export async function findActiveAutomationsByTrigger(
  triggerType: string,
  propertyId: string,
  companyId?: string
): Promise<AutomationRow[]> {
  const supabase = createServiceRoleClient()

  // Fetch property-scoped automations + system automations for the same company
  const orParts = [`property_id.eq.${propertyId}`]
  if (companyId) {
    orParts.push(`and(property_id.is.null,company_id.eq.${companyId})`)
  }

  const { data, error } = await supabase
    .from('automations' as any)
    .select('*')
    .or(orParts.join(','))
    .eq('is_active', true)
    .eq('trigger_type', triggerType)

  if (error) {
    console.error('[automations] findActiveAutomationsByTrigger failed', { triggerType, propertyId, companyId, error })
    throw error
  }

  return (data ?? []) as unknown as AutomationRow[]
}

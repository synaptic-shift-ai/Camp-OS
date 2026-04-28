/**
 * Automation Engine Types
 *
 * Core type definitions for the automations system.
 * These types mirror the database schema in
 * scripts/20260417000001_create_automations_tables.sql
 */

// ============================================================================
// Phase & Ordering
// ============================================================================

export type AutomationPhase =
  | 'GUARD'
  | 'PRICE'
  | 'ENFORCE'
  | 'OPERATE'
  | 'COMMUNICATE'
  | 'LOG'

/** Execution order: phases are evaluated from first to last */
export const PHASE_ORDER: readonly AutomationPhase[] = [
  'GUARD',
  'PRICE',
  'ENFORCE',
  'OPERATE',
  'COMMUNICATE',
  'LOG',
] as const

// ============================================================================
// Trigger Types
// ============================================================================

export type TriggerType =
  // Reservation lifecycle
  | 'reservation.created'
  | 'reservation.confirmed'
  | 'reservation.cancelled'
  | 'reservation.modified'
  | 'reservation.checked_in'
  | 'reservation.checked_out'
  | 'reservation.no_show'
  // Guest events
  | 'guest.registered'
  | 'guest.updated'
  | 'guest.checked_out'
  // Payment events
  | 'payment.received'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.refunded'
  | 'refund.processed'
  // Site / property events
  | 'site.status_changed'
  | 'site.maintenance_started'
  | 'site.maintenance_completed'
  // Housekeeping / maintenance
  | 'housekeeping.task_created'
  | 'housekeeping.task_completed'
  | 'maintenance.task_created'
  | 'maintenance.task_completed'
  // System / scheduled
  | 'system.scheduled'
  | 'system.check_in_reminder'
  | 'system.check_out_reminder'

// ============================================================================
// Condition Operators
// ============================================================================

export type ConditionOperator =
  | 'IS'
  | 'IS_NOT'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'BETWEEN'
  | 'BEFORE'
  | 'AFTER'
  | 'WITHIN_DATE_GROUP'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'IS_TRUE'
  | 'IS_FALSE'

// ============================================================================
// Action Types
// ============================================================================

export type ActionType =
  // GUARD phase
  | 'block_reservation'
  | 'flag_for_review'
  // PRICE phase
  | 'apply_price_modifier'
  | 'apply_discount'
  | 'apply_surcharge'
  // ENFORCE phase
  | 'require_document'
  | 'require_deposit'
  | 'enforce_policy'
  // OPERATE phase
  | 'create_work_order'
  | 'assign_staff'
  | 'update_site_status'
  // COMMUNICATE phase
  | 'send_email'
  | 'send_sms'
  | 'send_notification'
  // LOG phase
  | 'log_activity'
  | 'create_audit_entry'

// ============================================================================
// Scope & Misc
// ============================================================================

export type AutomationScope = 'property' | 'system'

export type LogicOperator = 'AND' | 'OR'

export type BranchType = 'THEN' | 'ELSE'

export type DelayUnit = 'minutes' | 'hours' | 'days'

// ============================================================================
// Event Context (passed to condition evaluators)
// ============================================================================

export interface EventContext {
  event: {
    type: string
    timestamp: Date
  }
  reservation?: Record<string, unknown>
  guest?: Record<string, unknown>
  property?: Record<string, unknown>
  site?: Record<string, unknown>
  payment?: Record<string, unknown>
  housekeeping?: Record<string, unknown>
  maintenance?: Record<string, unknown>
}

// ============================================================================
// Database Row Types
// ============================================================================

export interface AutomationRow {
  id: string
  company_id: string
  property_id: string | null
  name: string
  description: string | null
  phase: AutomationPhase
  scope: AutomationScope
  is_active: boolean
  is_terminal: boolean
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AutomationConditionGroupRow {
  id: string
  automation_id: string
  parent_group_id: string | null
  logic_operator: LogicOperator
  sort_order: number
  created_at: string
}

export interface AutomationConditionRow {
  id: string
  automation_id: string
  group_id: string
  variable: string
  operator: ConditionOperator
  value: unknown
  sort_order: number
  created_at: string
}

export interface AutomationActionRow {
  id: string
  automation_id: string
  branch_id: string | null
  action_type: ActionType
  action_config: Record<string, unknown>
  delay_value: number | null
  delay_unit: DelayUnit | null
  sort_order: number
  created_at: string
}

export interface AutomationBranchRow {
  id: string
  automation_id: string
  parent_action_id: string
  branch_type: BranchType
  created_at: string
}

export interface AutomationExecutionLogRow {
  id: string
  automation_id: string | null
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

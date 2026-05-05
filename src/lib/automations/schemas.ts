/**
 * Automation Validation Schemas
 *
 * Zod schemas for validating automation create/update payloads.
 */

import { z } from 'zod'
import { PHASE_ORDER } from './types'

// ============================================================================
// Primitive Schemas
// ============================================================================

export const AutomationPhaseSchema = z.enum(
  PHASE_ORDER as unknown as [string, ...string[]]
)

export const AutomationScopeSchema = z.enum(['property', 'system'])

export const TriggerTypeSchema = z.enum([
  'reservation.created',
  'reservation.confirmed',
  'reservation.cancelled',
  'reservation.modified',
  'reservation.checked_in',
  'reservation.checked_out',
  'reservation.no_show',
  'guest.updated',
  'refund.processed',
  'site.status_changed',
  'site.maintenance_started',
  'housekeeping.task_created',
  'housekeeping.task_completed',
  'maintenance.task_created',
  'maintenance.task_completed',
  'system.scheduled',
  'system.check_in_reminder',
  'system.check_out_reminder',
])

export const ConditionOperatorSchema = z.enum([
  'IS',
  'IS_NOT',
  'GT',
  'LT',
  'GTE',
  'LTE',
  'BETWEEN',
  'BEFORE',
  'AFTER',
  'WITHIN_DATE_GROUP',
  'CONTAINS',
  'NOT_CONTAINS',
  'IS_TRUE',
  'IS_FALSE',
])

export const ActionTypeSchema = z.enum([
  'block_reservation',
  'flag_for_review',
  'apply_price_modifier',
  'apply_discount',
  'apply_surcharge',
  'require_document',
  'require_deposit',
  'enforce_policy',
  'create_work_order',
  'assign_staff',
  'update_site_status',
  'send_email',
  'send_sms',
  'send_notification',
  'log_activity',
  'create_audit_entry',
])

export const DelayUnitSchema = z.enum(['minutes', 'hours', 'days'])

export const LogicOperatorSchema = z.enum(['AND', 'OR'])

export const BranchTypeSchema = z.enum(['THEN', 'ELSE'])

// ============================================================================
// Condition Schema (defined before groups — groups reference this)
// ============================================================================

export const ConditionSchema = z.object({
  id: z.string().uuid().optional(),
  variable: z.string().min(1),
  operator: ConditionOperatorSchema,
  value: z.unknown(),
  sortOrder: z.number().int().min(0).optional(),
})

export type ConditionInput = z.infer<typeof ConditionSchema>

// ============================================================================
// Condition Group Schema
// ============================================================================

export const ConditionGroupSchema = z.object({
  id: z.string().uuid().optional(),
  parentGroupId: z.string().uuid().nullable().optional(),
  logicOperator: LogicOperatorSchema,
  sortOrder: z.number().int().min(0).optional(),
  conditions: z.array(ConditionSchema).optional(),
})

export type ConditionGroupInput = z.infer<typeof ConditionGroupSchema>

// ============================================================================
// Action Schema
// ============================================================================

export const ActionSchema = z.object({
  id: z.string().uuid().optional(),
  branchId: z.string().uuid().nullable().optional(),
  actionType: ActionTypeSchema,
  actionConfig: z.record(z.unknown()).optional(),
  delayValue: z.number().int().min(0).optional().nullable(),
  delayUnit: DelayUnitSchema.optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
})

export type ActionInput = z.infer<typeof ActionSchema>

// ============================================================================
// Create Automation Schema
// ============================================================================

export const CreateAutomationSchema = z
  .object({
    companyId: z.string().uuid().optional(),
    propertyId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    phase: AutomationPhaseSchema,
    scope: AutomationScopeSchema.optional(),
    isActive: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
    triggerType: TriggerTypeSchema,
    triggerConfig: z.record(z.unknown()).optional(),
    sortOrder: z.number().int().min(0).optional(),
    conditionGroups: z.array(ConditionGroupSchema).optional(),
    actions: z.array(ActionSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.isTerminal && data.phase !== 'GUARD') return false
      return true
    },
    { message: 'isTerminal can only be true for GUARD phase' }
  )
  .refine(
    (data) => {
      if (data.scope === 'system' && data.propertyId) return false
      return true
    },
    { message: 'System-scoped automations must not specify a propertyId' }
  )
  .refine(
    (data) => {
      if (!data.companyId) return false
      return true
    },
    { message: 'companyId is required' }
  )

export type CreateAutomationInput = z.infer<typeof CreateAutomationSchema>

// ============================================================================
// Update Automation Schema
// ============================================================================

export const UpdateAutomationSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
    phase: AutomationPhaseSchema.optional(),
    scope: AutomationScopeSchema.optional(),
    isActive: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
    triggerType: TriggerTypeSchema.optional(),
    triggerConfig: z.record(z.unknown()).optional(),
    sortOrder: z.number().int().min(0).optional(),
    conditionGroups: z.array(ConditionGroupSchema).optional(),
    actions: z.array(ActionSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.isTerminal && data.phase && data.phase !== 'GUARD') return false
      return true
    },
    { message: 'isTerminal can only be true for GUARD phase' }
  )

export type UpdateAutomationInput = z.infer<typeof UpdateAutomationSchema>

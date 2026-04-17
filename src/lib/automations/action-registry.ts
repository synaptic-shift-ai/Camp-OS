import type { ActionType, EventContext } from './types'

export interface ActionHandler {
  execute(actionConfig: Record<string, unknown>, context: EventContext): Promise<void>
}

export type ActionHandlerMap = Map<ActionType, ActionHandler>

/**
 * Registry of action handlers — stubs for now, real implementations later.
 */
export function createActionRegistry(): ActionHandlerMap {
  const registry = new Map<ActionType, ActionHandler>()

  const stubTypes: ActionType[] = [
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
  ]

  for (const type of stubTypes) {
    registry.set(type, {
      async execute(config) {
        console.log(`[Automation Action] ${type} executed (stub)`, { config })
      },
    })
  }

  return registry
}

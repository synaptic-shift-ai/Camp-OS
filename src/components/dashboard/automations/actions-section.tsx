"use client"

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ActionItem } from "./action-item"
import type { ActionType, AutomationPhase, DelayUnit } from "@/lib/automations/types"

// ============================================================================
// Constants
// ============================================================================

const ACTIONS_BY_PHASE: Record<AutomationPhase, Array<{ type: ActionType; label: string; description: string }>> = {
  GUARD: [
    { type: "block_reservation", label: "Block Reservation", description: "Block the reservation from proceeding" },
    { type: "flag_for_review", label: "Flag for Review", description: "Flag for manual staff review" },
  ],
  PRICE: [
    { type: "apply_price_modifier", label: "Apply Price Modifier", description: "Modify pricing based on conditions" },
    { type: "apply_discount", label: "Apply Discount", description: "Apply a discount to the reservation" },
    { type: "apply_surcharge", label: "Apply Surcharge", description: "Add a surcharge to the reservation" },
  ],
  ENFORCE: [
    { type: "require_document", label: "Require Document", description: "Require guest to upload a document" },
    { type: "require_deposit", label: "Require Deposit", description: "Require a security deposit" },
    { type: "enforce_policy", label: "Enforce Policy", description: "Enforce a property policy" },
  ],
  OPERATE: [
    { type: "create_work_order", label: "Create Work Order", description: "Create a work order for staff" },
    { type: "assign_staff", label: "Assign Staff", description: "Automatically assign staff" },
    { type: "update_site_status", label: "Update Site Status", description: "Change the site status" },
  ],
  COMMUNICATE: [
    { type: "send_email", label: "Send Email", description: "Send an email notification" },
    { type: "send_sms", label: "Send SMS", description: "Send an SMS message" },
    { type: "send_notification", label: "Send Notification", description: "Send an in-app notification" },
  ],
  LOG: [
    { type: "log_activity", label: "Log Activity", description: "Log an activity entry" },
    { type: "create_audit_entry", label: "Create Audit Entry", description: "Create an audit trail entry" },
  ],
}

// ============================================================================
// Types
// ============================================================================

export type AutomationActionFormData = {
  id: string
  actionType: ActionType
  actionConfig: Record<string, unknown>
  delayValue: number | null
  delayUnit: DelayUnit | null
}

// ============================================================================
// Component
// ============================================================================

type ActionsSectionProps = {
  actions: AutomationActionFormData[]
  phase: AutomationPhase
  onChange: (actions: AutomationActionFormData[]) => void
  propertyId?: string
}

export function ActionsSection({ actions, phase, onChange, propertyId }: ActionsSectionProps) {
  const availableActions = ACTIONS_BY_PHASE[phase] ?? []

  const addAction = (actionType: ActionType) => {
    onChange([
      ...actions,
      {
        id: crypto.randomUUID(),
        actionType,
        actionConfig: {},
        delayValue: null,
        delayUnit: null,
      },
    ])
  }

  const updateAction = (index: number, updated: AutomationActionFormData) => {
    const next = [...actions]
    next[index] = updated
    onChange(next)
  }

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index))
  }

  const moveAction = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= actions.length) return
    const next = [...actions]
    const a = next[index]
    const b = next[newIndex]
    if (!a || !b) return
    next[index] = b
    next[newIndex] = a
    onChange(next)
  }

  const existingTypes = new Set(actions.map(a => a.actionType))

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Actions</h3>
        <p className="text-sm text-muted-foreground">
          Define what happens when this automation executes. Actions run in order.
        </p>
      </div>

      {actions.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
          No actions defined. Add an action to define the automation&apos;s behavior.
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action, index) => (
            <ActionItem
              key={action.id}
              action={action}
              index={index + 1}
              canMoveUp={index > 0}
              canMoveDown={index < actions.length - 1}
              onUpdate={updated => updateAction(index, updated)}
              onRemove={() => removeAction(index)}
              onMoveUp={() => moveAction(index, "up")}
              onMoveDown={() => moveAction(index, "down")}
              {...(propertyId != null ? { propertyId } : {})}
            />
          ))}
        </div>
      )}

      {/* Add action buttons */}
      {availableActions.filter(a => !existingTypes.has(a.type)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableActions
            .filter(a => !existingTypes.has(a.type))
            .map(a => (
              <Button
                key={a.type}
                variant="outline"
                size="sm"
                className="text-sm"
                onClick={() => addAction(a.type)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {a.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}

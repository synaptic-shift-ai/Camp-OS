"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Trash2, ChevronUp, ChevronDown, ChevronRight, Clock } from "lucide-react"
import type { ActionType, DelayUnit } from "@/lib/automations/types"
import type { AutomationActionFormData } from "./actions-section"
import { cn } from "@/lib/utils"

// ============================================================================
// Dynamic template hook
// ============================================================================

type TemplateOption = { value: string; label: string }

function useEmailTemplates(propertyId: string | undefined) {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/v1/automations/email-templates?propertyId=${propertyId}`)
      .then(res => res.json())
      .then(payload => {
        if (cancelled) return
        const list = payload?.data?.emailTemplates ?? []
        if (Array.isArray(list)) {
          setTemplates(
            list
              .filter((t: Record<string, unknown>) => t.status === 'active')
              .map((t: Record<string, unknown>) => ({
                value: String(t.slug),
                label: String(t.name),
              }))
          )
        }
      })
      .catch(() => { /* empty list on error */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [propertyId])

  return { templates, loading }
}

function EmailTemplateSelector({ propertyId, actionConfig, onUpdate }: { propertyId?: string; actionConfig: Record<string, unknown>; onUpdate: (key: string, value: unknown) => void }) {
  const { templates, loading } = useEmailTemplates(propertyId)
  return (
    <ConfigField label="Email Template">
      <Select value={String(actionConfig.template ?? "")} onValueChange={v => onUpdate("template", v)}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={loading ? "Loading templates..." : "Select a template..."} />
        </SelectTrigger>
        <SelectContent>
          {templates.map(t => (
            <SelectItem key={t.value} value={t.value} className="text-sm">
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ConfigField>
  )
}

// ============================================================================
// Component
// ============================================================================

type ActionItemProps = {
  action: AutomationActionFormData
  index: number
  canMoveUp: boolean
  canMoveDown: boolean
  onUpdate: (action: AutomationActionFormData) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  propertyId?: string
}

export function ActionItem({
  action,
  index,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  propertyId,
}: ActionItemProps) {
  const [isOpen, setIsOpen] = useState(true)

  const updateConfig = (key: string, value: unknown) => {
    onUpdate({ ...action, actionConfig: { ...action.actionConfig, [key]: value } })
  }

  const updateDelay = (field: "delayValue" | "delayUnit", value: unknown) => {
    onUpdate({ ...action, [field]: value })
  }

  const hasDelay = action.delayValue !== null && action.delayUnit !== null
  const configFieldCount = Object.keys(action.actionConfig).length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </CollapsibleTrigger>

          <span className="text-sm font-medium text-muted-foreground w-6 text-center shrink-0">{index}</span>

          <Badge variant="secondary" className="text-xs shrink-0">
            {formatActionLabel(action.actionType)}
          </Badge>

          {hasDelay && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>after {action.delayValue} {action.delayUnit}{action.delayValue !== 1 ? "s" : ""}</span>
            </div>
          )}

          {configFieldCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {configFieldCount} field{configFieldCount !== 1 ? "s" : ""} configured
            </span>
          )}

          <div className="flex-1" />

          {/* Move buttons */}
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canMoveUp} onClick={onMoveUp}>
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canMoveDown} onClick={onMoveDown}>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 shrink-0",
              hasDelay
                ? "text-blue-600 dark:text-blue-400"
                : "text-muted-foreground"
            )}
            onClick={() => {
              if (hasDelay) {
                onUpdate({ ...action, delayValue: null, delayUnit: null })
              } else {
                onUpdate({ ...action, delayValue: 0, delayUnit: "minutes" })
              }
            }}
            title={hasDelay ? "Remove delay" : "Add delay"}
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Config body */}
        <CollapsibleContent>
          <div className="px-4 py-3 space-y-3 border-t bg-background">
            <ActionConfigForm action={action} onUpdate={updateConfig} {...(propertyId != null ? { propertyId } : {})} />
            {hasDelay && (
              <DelayConfig
                delayValue={action.delayValue}
                delayUnit={action.delayUnit}
                onUpdate={updateDelay}
              />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ============================================================================
// Action Config Form — dynamic based on action type
// ============================================================================

function ActionConfigForm({
  action,
  onUpdate,
  propertyId,
}: {
  action: AutomationActionFormData
  onUpdate: (key: string, value: unknown) => void
  propertyId?: string
}) {
  const { actionType, actionConfig } = action

  switch (actionType) {
    case "block_reservation":
    case "flag_for_review":
      return (
        <ConfigField label="Reason">
          <Textarea
            className="text-sm"
            value={String(actionConfig.reason ?? "")}
            onChange={e => onUpdate("reason", e.target.value)}
            rows={2}
            placeholder="e.g., High-risk reservation blocked for review"
          />
        </ConfigField>
      )

    case "apply_price_modifier":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ConfigField label="Type">
              <Select value={String(actionConfig.type ?? "percentage")} onValueChange={v => onUpdate("type", v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat ($)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </ConfigField>
            <ConfigField label="Value">
              <Input
                type="number"
                className="h-9 text-sm"
                value={String(actionConfig.value ?? "")}
                onChange={e => onUpdate("value", Number(e.target.value))}
                placeholder="10"
              />
            </ConfigField>
          </div>
          <ConfigField label="Reason">
            <Input
              className="h-9 text-sm"
              value={String(actionConfig.reason ?? "")}
              onChange={e => onUpdate("reason", e.target.value)}
              placeholder="e.g., Weekend premium pricing"
            />
          </ConfigField>
        </>
      )

    case "apply_discount":
    case "apply_surcharge":
      return (
        <>
          <ConfigField label={actionType === "apply_discount" ? "Discount Reason" : "Surcharge Reason"}>
            <Input
              className="h-9 text-sm"
              value={String(actionConfig.reason ?? "")}
              onChange={e => onUpdate("reason", e.target.value)}
              placeholder="e.g., Early bird discount"
            />
          </ConfigField>
          <div className="grid grid-cols-2 gap-3">
            <ConfigField label="Type">
              <Select value={String(actionConfig.type ?? "percentage")} onValueChange={v => onUpdate("type", v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat ($)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </ConfigField>
            <ConfigField label="Value">
              <Input
                type="number"
                className="h-9 text-sm"
                value={String(actionConfig.value ?? "")}
                onChange={e => onUpdate("value", Number(e.target.value))}
                placeholder="10"
              />
            </ConfigField>
          </div>
        </>
      )

    case "require_document":
      return (
        <>
          <ConfigField label="Document Type">
            <Input
              className="h-9 text-sm"
              value={String(actionConfig.document_type ?? "")}
              onChange={e => onUpdate("document_type", e.target.value)}
              placeholder="e.g., government_id, liability_waiver, pet_agreement"
            />
          </ConfigField>
          <ConfigField label="Deadline">
            <Input
              className="h-9 text-sm"
              value={String(actionConfig.deadline ?? "")}
              onChange={e => onUpdate("deadline", e.target.value)}
              placeholder="e.g., check_in, 24_hours_before"
            />
          </ConfigField>
          <ConfigField label="Message">
            <Textarea
              className="text-sm"
              value={String(actionConfig.message ?? "")}
              onChange={e => onUpdate("message", e.target.value)}
              rows={2}
              placeholder="Message shown to guest when document is required"
            />
          </ConfigField>
        </>
      )

    case "require_deposit":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ConfigField label="Type">
              <Select value={String(actionConfig.type ?? "security_deposit")} onValueChange={v => onUpdate("type", v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="security_deposit">Security Deposit</SelectItem>
                </SelectContent>
              </Select>
            </ConfigField>
            <ConfigField label="Amount">
              <Input
                type="number"
                className="h-9 text-sm"
                value={String(actionConfig.amount ?? "")}
                onChange={e => onUpdate("amount", Number(e.target.value))}
                placeholder="100"
              />
            </ConfigField>
          </div>
          <ConfigField label="Reason">
            <Input
              className="h-9 text-sm"
              value={String(actionConfig.reason ?? "")}
              onChange={e => onUpdate("reason", e.target.value)}
              placeholder="e.g., Security deposit for high-value reservations"
            />
          </ConfigField>
        </>
      )

    case "enforce_policy":
      return (
        <ConfigField label="Message">
          <Textarea
            className="text-sm"
            value={String(actionConfig.message ?? "")}
            onChange={e => onUpdate("message", e.target.value)}
            rows={2}
            placeholder="e.g., Pet agreement required for guests bringing pets"
          />
        </ConfigField>
      )

    case "create_work_order":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ConfigField label="Work Order Type">
              <Select value={String(actionConfig.type ?? "maintenance")} onValueChange={v => onUpdate("type", v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                </SelectContent>
              </Select>
            </ConfigField>
            <ConfigField label="Priority">
              <Select value={String(actionConfig.priority ?? "medium")} onValueChange={v => onUpdate("priority", v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </ConfigField>
          </div>
          <ConfigField label="Assign To">
            <Input
              className="h-9 text-sm"
              value={String(actionConfig.assign_to ?? "")}
              onChange={e => onUpdate("assign_to", e.target.value)}
              placeholder="e.g., housekeeping_queue, maintenance_queue"
            />
          </ConfigField>
        </>
      )

    case "assign_staff":
      return (
        <div className="grid grid-cols-2 gap-3">
          <ConfigField label="Method">
            <Select value={String(actionConfig.method ?? "auto")} onValueChange={v => onUpdate("method", v)}>
              <SelectTrigger className="h-9 text-sm w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </ConfigField>
          <ConfigField label="Based On">
            <Input
              className="h-9 text-sm"
              value={String(actionConfig.based_on ?? "")}
              onChange={e => onUpdate("based_on", e.target.value)}
              placeholder="e.g., availability, workload"
            />
          </ConfigField>
        </div>
      )

    case "update_site_status":
      return (
        <ConfigField label="Status">
          <Input
            className="h-9 text-sm"
            value={String(actionConfig.status ?? "")}
            onChange={e => onUpdate("status", e.target.value)}
            placeholder="e.g., available, maintenance, cleaning"
          />
        </ConfigField>
      )

    case "send_email":
      return <EmailTemplateSelector {...(propertyId != null ? { propertyId } : {})} actionConfig={actionConfig} onUpdate={onUpdate} />

    case "send_notification":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ConfigField label="Channel">
              <Select value={String(actionConfig.channel ?? "staff")} onValueChange={v => onUpdate("channel", v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </ConfigField>
            <ConfigField label="Priority">
              <Select value={String(actionConfig.priority ?? "medium")} onValueChange={v => onUpdate("priority", v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </ConfigField>
          </div>
          <ConfigField label="Message">
            <Textarea
              className="text-sm"
              value={String(actionConfig.message ?? "")}
              onChange={e => onUpdate("message", e.target.value)}
              rows={2}
              placeholder="Notification message"
            />
          </ConfigField>
        </>
      )

    case "send_sms":
      return (
        <ConfigField label="Message">
          <Textarea
            className="text-sm"
            value={String(actionConfig.message ?? "")}
            onChange={e => onUpdate("message", e.target.value)}
            rows={2}
            placeholder="SMS message content"
          />
        </ConfigField>
      )

    case "log_activity":
    case "create_audit_entry":
      return (
        <ConfigField label="Message">
          <Textarea
            className="text-sm"
            value={String(actionConfig.message ?? "")}
            onChange={e => onUpdate("message", e.target.value)}
            rows={2}
            placeholder="Activity to log"
          />
        </ConfigField>
      )

    default:
      return (
        <p className="text-sm text-muted-foreground">
          No configuration needed for this action type.
        </p>
      )
  }
}

// ============================================================================
// Delay Config — simple inline, no toggle hack
// ============================================================================

function DelayConfig({
  delayValue,
  delayUnit,
  onUpdate,
}: {
  delayValue: number | null
  delayUnit: DelayUnit | null
  onUpdate: (field: "delayValue" | "delayUnit", value: unknown) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
        <Clock className="h-3.5 w-3.5" />
        Delay
      </Label>
      <Input
        type="number"
        min={0}
        className="h-9 text-sm w-24"
        value={delayValue ?? ""}
        onChange={e => {
          const v = e.target.value
          if (v === "") {
            onUpdate("delayValue", null)
            onUpdate("delayUnit", null)
          } else {
            onUpdate("delayValue", Number(v))
            if (!delayUnit) onUpdate("delayUnit", "minutes")
          }
        }}
        placeholder="0"
      />
      <Select
        value={delayUnit ?? "minutes"}
        onValueChange={v => {
          onUpdate("delayUnit", v as DelayUnit)
          // If value is empty, initialize to 0 so delay is active
          if (delayValue === null) onUpdate("delayValue", 0)
        }}
      >
        <SelectTrigger className="h-9 text-sm w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="minutes">Minutes</SelectItem>
          <SelectItem value="hours">Hours</SelectItem>
          <SelectItem value="days">Days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function ConfigField({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {description && (
          <span className="text-muted-foreground font-normal ml-1">— {description}</span>
        )}
      </Label>
      {children}
    </div>
  )
}

function formatActionLabel(actionType: ActionType): string {
  return actionType
    .replace(/_/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase())
}

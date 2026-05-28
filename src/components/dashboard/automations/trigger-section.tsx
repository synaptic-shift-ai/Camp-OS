"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Shield,
  DollarSign,
  FileCheck,
  Wrench,
  Mail,
  ScrollText,
} from "lucide-react"
import {
  type AutomationPhase,
  type TriggerType,
  PHASE_ORDER,
} from "@/lib/automations/types"
import { PHASE_COLORS } from "@/lib/automations/templates"
import { cn } from "@/lib/utils"

// ============================================================================
// Constants
// ============================================================================

const PHASE_META: Record<AutomationPhase, { label: string; description: string; icon: typeof Shield }> = {
  GUARD: { label: "Guard", description: "Block or flag reservations", icon: Shield },
  PRICE: { label: "Price", description: "Modify pricing and discounts", icon: DollarSign },
  ENFORCE: { label: "Enforce", description: "Require documents and deposits", icon: FileCheck },
  OPERATE: { label: "Operate", description: "Create work orders and assign staff", icon: Wrench },
  COMMUNICATE: { label: "Communicate", description: "Send emails, SMS, notifications", icon: Mail },
  LOG: { label: "Log", description: "Record activity and audit entries", icon: ScrollText },
}

const TRIGGER_GROUPS: Array<{ label: string; triggers: TriggerType[] }> = [
  {
    label: "Reservation",
    triggers: [
      "reservation.created",
      "reservation.confirmed",
      "reservation.cancelled",
      "reservation.modified",
      "reservation.checked_in",
      "reservation.checked_out",
      "reservation.no_show",
    ],
  },
  {
    label: "Guest",
    triggers: ["guest.updated"],
  },
  {
    label: "Payment",
    triggers: ["refund.processed"],
  },
  {
    label: "Site",
    triggers: ["site.status_changed", "site.maintenance_started"],
  },
  {
    label: "Housekeeping",
    triggers: ["housekeeping.task_created", "housekeeping.task_completed"],
  },
  {
    label: "Maintenance",
    triggers: ["maintenance.task_created", "maintenance.task_completed"],
  },
  {
    label: "System",
    triggers: [
      "system.scheduled",
      "system.check_in_reminder",
      "system.pre_arrival_reminder",
      "system.check_out_reminder",
    ],
  },
]

// ============================================================================
// Component
// ============================================================================

type TriggerSectionProps = {
  phase: AutomationPhase
  triggerType: TriggerType
  isEdit: boolean
  onPhaseChange: (phase: AutomationPhase) => void
  onTriggerTypeChange: (trigger: TriggerType) => void
}

export function TriggerSection({
  phase,
  triggerType,
  isEdit,
  onPhaseChange,
  onTriggerTypeChange,
}: TriggerSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-1">Trigger & Phase</h3>
        <p className="text-xs text-muted-foreground">
          Define when this automation fires and which execution phase it belongs to.
        </p>
      </div>

      {/* Phase selector — only editable during creation */}
      <div className="space-y-2">
        <Label>Phase {isEdit && <span className="text-muted-foreground font-normal">(set on creation)</span>}</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PHASE_ORDER.filter(p => p === 'COMMUNICATE').map(p => {
            const meta = PHASE_META[p]
            const Icon = meta.icon
            const selected = phase === p

            return (
              <button
                key={p}
                type="button"
                disabled={isEdit}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border text-left transition-colors",
                  "disabled:opacity-100 cursor-default",
                  selected
                    ? cn("border-primary ring-1 ring-primary/20", PHASE_COLORS[p])
                    : "border-border hover:bg-muted/50"
                )}
                onClick={() => !isEdit && onPhaseChange(p)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{meta.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Trigger type */}
      <div className="space-y-2">
        <Label htmlFor="trigger-type">Trigger Type</Label>
        <Select value={triggerType} onValueChange={v => onTriggerTypeChange(v as TriggerType)}>
          <SelectTrigger id="trigger-type">
            <SelectValue placeholder="Select a trigger..." />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_GROUPS.map(group => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.triggers.map(trigger => (
                  <SelectItem key={trigger} value={trigger}>
                    <span className="font-mono text-xs">{trigger}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

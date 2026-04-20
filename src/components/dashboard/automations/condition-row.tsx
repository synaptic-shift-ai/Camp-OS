"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Trash2, ChevronUp, ChevronDown, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import type { ConditionOperator } from "@/lib/automations/types"
import type { ConditionNode } from "@/lib/automations/condition-tree"
import { cn } from "@/lib/utils"

// ============================================================================
// Constants
// ============================================================================

export const KNOWN_VARIABLES: Array<{ value: string; label: string; group: string }> = [
  // Reservation
  { value: "reservation.status", label: "Status", group: "Reservation" },
  { value: "reservation.risk_score", label: "Risk Score", group: "Reservation" },
  { value: "reservation.lead_time_hours", label: "Lead Time (hours)", group: "Reservation" },
  { value: "reservation.lead_time_days", label: "Lead Time (days)", group: "Reservation" },
  { value: "reservation.has_overlap", label: "Has Overlap", group: "Reservation" },
  { value: "reservation.duration_nights", label: "Duration (nights)", group: "Reservation" },
  { value: "reservation.total_value", label: "Total Value", group: "Reservation" },
  { value: "reservation.is_new_guest", label: "Is New Guest", group: "Reservation" },
  { value: "reservation.has_pets", label: "Has Pets", group: "Reservation" },
  { value: "reservation.is_holiday_period", label: "Is Holiday Period", group: "Reservation" },
  { value: "reservation.includes_friday", label: "Includes Friday", group: "Reservation" },
  { value: "reservation.includes_saturday", label: "Includes Saturday", group: "Reservation" },
  { value: "reservation.is_peak_season", label: "Is Peak Season", group: "Reservation" },
  { value: "reservation.site_count", label: "Site Count", group: "Reservation" },
  { value: "reservation.check_in_date", label: "Check-in Date", group: "Reservation" },
  { value: "reservation.check_out_date", label: "Check-out Date", group: "Reservation" },
  { value: "reservation.num_guests", label: "Number of Guests", group: "Reservation" },
  { value: "reservation.num_pets", label: "Number of Pets", group: "Reservation" },
  // Guest
  { value: "guest.is_blacklisted", label: "Is Blacklisted", group: "Guest" },
  { value: "guest.is_returning", label: "Is Returning Guest", group: "Guest" },
  { value: "guest.previous_stays", label: "Previous Stays", group: "Guest" },
  { value: "guest.tier", label: "Guest Tier", group: "Guest" },
  { value: "guest.email", label: "Email", group: "Guest" },
  { value: "guest.first_name", label: "First Name", group: "Guest" },
  { value: "guest.last_name", label: "Last Name", group: "Guest" },
  { value: "guest.phone", label: "Phone", group: "Guest" },
  // Property
  { value: "property.requires_waiver", label: "Requires Waiver", group: "Property" },
  { value: "property.name", label: "Property Name", group: "Property" },
  { value: "property.timezone", label: "Timezone", group: "Property" },
  // Site
  { value: "site.status", label: "Status", group: "Site" },
  { value: "site.type", label: "Type", group: "Site" },
  { value: "site.name", label: "Site Name", group: "Site" },
  // Payment
  { value: "payment.amount", label: "Amount", group: "Payment" },
  { value: "payment.method", label: "Method", group: "Payment" },
  { value: "payment.status", label: "Status", group: "Payment" },
]

const OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: "IS", label: "is" },
  { value: "IS_NOT", label: "is not" },
  { value: "GT", label: "greater than" },
  { value: "LT", label: "less than" },
  { value: "GTE", label: "≥ (at least)" },
  { value: "LTE", label: "≤ (at most)" },
  { value: "BETWEEN", label: "between" },
  { value: "BEFORE", label: "before (date)" },
  { value: "AFTER", label: "after (date)" },
  { value: "WITHIN_DATE_GROUP", label: "within date range" },
  { value: "CONTAINS", label: "contains" },
  { value: "NOT_CONTAINS", label: "does not contain" },
  { value: "IS_TRUE", label: "is true" },
  { value: "IS_FALSE", label: "is false" },
]

// Group variables for select optgroups
const VARIABLE_GROUPS: Array<{ label: string; variables: typeof KNOWN_VARIABLES }> = []
let currentGroup = ""
for (const v of KNOWN_VARIABLES) {
  if (v.group !== currentGroup) {
    currentGroup = v.group
    VARIABLE_GROUPS.push({ label: currentGroup, variables: [] })
  }
  const last = VARIABLE_GROUPS[VARIABLE_GROUPS.length - 1]
  last?.variables.push(v)
}

// Operators that need no value input
const NO_VALUE_OPERATORS: Set<string> = new Set(["IS_TRUE", "IS_FALSE"])

// Operators that need number input
const NUMBER_OPERATORS: Set<string> = new Set(["GT", "LT", "GTE", "LTE"])

// Operators that need date input
const DATE_OPERATORS: Set<string> = new Set(["BEFORE", "AFTER", "WITHIN_DATE_GROUP"])

// ============================================================================
// Component
// ============================================================================

type ConditionRowProps = {
  condition: ConditionNode
  canMoveUp: boolean
  canMoveDown: boolean
  onUpdate: (condition: ConditionNode) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  readOnly?: boolean
}

export function ConditionRow({
  condition,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  readOnly = false,
}: ConditionRowProps) {
  const needsValue = !NO_VALUE_OPERATORS.has(condition.operator)
  const isNumber = NUMBER_OPERATORS.has(condition.operator)
  const isDate = DATE_OPERATORS.has(condition.operator)
  const isBetween = condition.operator === "BETWEEN"

  const handleChange = (field: keyof ConditionNode, value: unknown) => {
    onUpdate({ ...condition, [field]: value })
  }

  return (
    <div className="flex items-start gap-2">
      {/* Move buttons */}
      {!readOnly && (
        <div className="flex flex-col gap-0.5 pt-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Variable select */}
      <div className="flex-1 min-w-0">
        <Label className="text-xs text-muted-foreground mb-1 block">Variable</Label>
        <Select
          value={condition.variable}
          onValueChange={v => handleChange("variable", v)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VARIABLE_GROUPS.map(group => (
              <SelectGroup key={group.label}>
                <SelectLabel className="text-xs">{group.label}</SelectLabel>
                {group.variables.map(v => (
                  <SelectItem key={v.value} value={v.value} className="text-sm">
                    {v.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Operator select */}
      <div className="w-44">
        <Label className="text-xs text-muted-foreground mb-1 block">Operator</Label>
        <Select
          value={condition.operator}
          onValueChange={v => {
            const newOp = v as ConditionOperator
            // Reset value when switching operator types
            let newValue = condition.value
            if (NO_VALUE_OPERATORS.has(newOp)) newValue = true
            else if (isBetween && !NO_VALUE_OPERATORS.has(newOp)) newValue = ""
            else if (NUMBER_OPERATORS.has(newOp)) newValue = 0
            else if (!NUMBER_OPERATORS.has(condition.operator) && !isDate) newValue = ""
            onUpdate({ ...condition, operator: newOp, value: newValue })
          }}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map(op => (
              <SelectItem key={op.value} value={op.value} className="text-sm">
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Value input */}
      {needsValue && (
        <div className={cn("min-w-0", isBetween ? "flex gap-1.5 flex-1" : "flex-1")}>
          <Label className="text-xs text-muted-foreground mb-1 block">
            {isBetween ? "Min / Max" : "Value"}
          </Label>

          {isBetween ? (
            <>
              <Input
                type="number"
                className="h-9 text-sm"
                value={(condition.value as [number, number])?.[0] ?? ""}
                onChange={e => {
                  const max = (condition.value as [number, number])?.[1] ?? 0
                  handleChange("value", [Number(e.target.value), max])
                }}
                placeholder="Min"
              />
              <Input
                type="number"
                className="h-9 text-sm"
                value={(condition.value as [number, number])?.[1] ?? ""}
                onChange={e => {
                  const min = (condition.value as [number, number])?.[0] ?? 0
                  handleChange("value", [min, Number(e.target.value)])
                }}
                placeholder="Max"
              />
            </>
          ) : isDate ? (
            condition.operator === "WITHIN_DATE_GROUP" ? (
              <div className="flex gap-1.5">
                <DateInput
                  value={(condition.value as { startDate: string })?.startDate}
                  onChange={d => {
                    const prev = (condition.value as { startDate: string; endDate: string }) ?? {}
                    handleChange("value", { ...prev, startDate: d })
                  }}
                  label="Start"
                />
                <DateInput
                  value={(condition.value as { endDate: string })?.endDate}
                  onChange={d => {
                    const prev = (condition.value as { startDate: string; endDate: string }) ?? {}
                    handleChange("value", { ...prev, endDate: d })
                  }}
                  label="End"
                />
              </div>
            ) : (
              <DateInput
                value={condition.value as string}
                onChange={d => handleChange("value", d)}
              />
            )
          ) : (
            <Input
              type={isNumber ? "number" : "text"}
              className="h-9 text-sm"
              value={typeof condition.value === "number" ? condition.value : String(condition.value ?? "")}
              onChange={e => {
                const raw = e.target.value
                handleChange("value", isNumber ? (raw ? Number(raw) : 0) : raw)
              }}
              placeholder={isNumber ? "0" : "Value"}
            />
          )}
        </div>
      )}

      {/* Remove */}
      {!readOnly && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 mt-6 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

// ============================================================================
// Date Input Helper
// ============================================================================

function DateInput({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label?: string }) {
  const date = value ? new Date(value) : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 text-sm gap-1 justify-start font-normal">
          <CalendarIcon className="h-3.5 w-3.5" />
          {date ? format(date, "MMM d, yyyy") : (label ?? "Pick a date")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={d => d && onChange(d.toISOString().split("T")[0] ?? "")}
        />
      </PopoverContent>
    </Popover>
  )
}

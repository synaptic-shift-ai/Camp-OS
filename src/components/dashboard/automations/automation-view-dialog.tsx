"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil, Copy, Zap } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useEffect, useState } from "react"
import type { AutomationRow, ActionType } from "@/lib/automations/types"
import { PHASE_COLORS } from "@/lib/automations/templates"
import { cn } from "@/lib/utils"

type AutomationViewDialogProps = {
  open: boolean
  automation: AutomationRow | null
  propertyId: string
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDuplicate: () => void
  onDryRun: () => void
}

type LoadedAutomation = {
  automation: AutomationRow
  conditionGroups: Array<{
    id: string
    logic_operator: string
    parent_group_id: string | null
    sort_order: number
  }>
  conditions: Array<{
    id: string
    group_id: string
    variable: string
    operator: string
    value: unknown
    sort_order: number
  }>
  actions: Array<{
    id: string
    action_type: ActionType
    action_config: Record<string, unknown>
    delay_value: number | null
    delay_unit: string | null
    sort_order: number
  }>
}

function formatTriggerType(trigger: string): string {
  return trigger
    .replace(/^([a-z]+)\./, (_, prefix) => {
      const labels: Record<string, string> = {
        reservation: "Reservation", guest: "Guest", payment: "Payment",
        site: "Site", housekeeping: "Housekeeping", maintenance: "Maintenance",
        system: "System", refund: "Refund",
      }
      return labels[prefix] ?? prefix
    })
    .replace(/_/g, " ")
}

function formatActionType(type: ActionType): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
}

function formatOperator(op: string): string {
  const map: Record<string, string> = {
    IS: "=", IS_NOT: "≠", GT: ">", LT: "<", GTE: "≥", LTE: "≤",
    BETWEEN: "between", BEFORE: "before", AFTER: "after",
    WITHIN_DATE_GROUP: "within range", CONTAINS: "contains",
    NOT_CONTAINS: "not contains", IS_TRUE: "true", IS_FALSE: "false",
  }
  return map[op] ?? op
}

export function AutomationViewDialog({
  open,
  automation,
  propertyId,
  onOpenChange,
  onEdit,
  onDuplicate,
  onDryRun,
}: AutomationViewDialogProps) {
  const [data, setData] = useState<LoadedAutomation | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !automation) {
      setData(null)
      return
    }

    setLoading(true)
    fetch(`/api/v1/automations/${automation.id}?propertyId=${propertyId}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(payload => setData(payload.data ?? payload))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [open, automation, propertyId])

  const auto = data?.automation ?? automation

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            {auto?.name ?? "Automation"}
            {auto && (
              <Badge variant="outline" className={cn("text-[10px] border-current", PHASE_COLORS[auto.phase])}>
                {auto.phase}
              </Badge>
            )}
          </DialogTitle>
          {auto?.description && (
            <DialogDescription>{auto.description}</DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto overflow-x-visible">
          {loading ? (
            <div className="px-6 py-6 space-y-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : data ? (
            <div className="px-6 pb-6 space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phase</p>
                  <Badge variant="outline" className={cn("border-current", PHASE_COLORS[data.automation.phase])}>
                    {data.automation.phase}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Trigger</p>
                  <p className="text-sm font-medium">{formatTriggerType(data.automation.trigger_type)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className={cn("text-sm font-medium", data.automation.is_active ? "text-green-600" : "text-muted-foreground")}>
                    {data.automation.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Terminal</p>
                  <p className="text-sm font-medium">
                    {data.automation.is_terminal ? "Yes" : "No"}
                  </p>
                </div>
              </div>

              {/* Conditions */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Conditions</h4>
                {data.conditions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No conditions — always executes.</p>
                ) : (
                  <div className="border rounded-md divide-y">
                    {data.conditions.map((c) => (
                      <div key={c.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {c.variable}
                        </Badge>
                        <span className="text-muted-foreground">{formatOperator(c.operator)}</span>
                        <span className="font-medium truncate">
                          {typeof c.value === "boolean"
                            ? String(c.value)
                            : c.value === null || c.value === undefined
                              ? "—"
                              : Array.isArray(c.value)
                                ? c.value.join(" – ")
                                : String(c.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Actions</h4>
                {data.actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No actions defined.</p>
                ) : (
                  <div className="border rounded-md divide-y">
                    {data.actions.map((a) => (
                      <div key={a.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {formatActionType(a.action_type)}
                        </Badge>
                        {a.delay_value != null && a.delay_unit && (
                          <span className="text-xs text-muted-foreground">
                            Delay: {a.delay_value} {a.delay_unit}{a.delay_value !== 1 ? "s" : ""}
                          </span>
                        )}
                        {Object.keys(a.action_config).length > 0 && (
                          <span className="text-xs text-muted-foreground truncate">
                            {Object.entries(a.action_config)
                              .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Failed to load automation details.
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <PermissionGate permission="automations.manage">
            <>
              <Button variant="outline" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button variant="outline" onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
              <Button variant="outline" onClick={onDryRun}>
                <Zap className="h-4 w-4 mr-1" />
                Dry Run
              </Button>
            </>
          </PermissionGate>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

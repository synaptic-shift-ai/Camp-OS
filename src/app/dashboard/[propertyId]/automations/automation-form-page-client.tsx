"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2, Save, Shield, DollarSign, FileCheck, Wrench, Mail, ScrollText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ConditionsSection } from "@/components/dashboard/automations/conditions-section"
import { ActionsSection } from "@/components/dashboard/automations/actions-section"
import { PHASE_ORDER, type AutomationPhase, type TriggerType, type ActionType, type DelayUnit } from "@/lib/automations/types"
import { PHASE_COLORS } from "@/lib/automations/templates"
import { CreateAutomationSchema } from "@/lib/automations/schemas"
import { flattenTree, hydrateTree, type ConditionGroupNode } from "@/lib/automations/condition-tree"
import { cn } from "@/lib/utils"

// ============================================================================
// Constants
// ============================================================================

const TRIGGER_GROUPS: Array<{ label: string; triggers: TriggerType[] }> = [
  {
    label: "Reservation",
    triggers: [
      "reservation.created", "reservation.confirmed", "reservation.cancelled",
      "reservation.modified", "reservation.checked_in", "reservation.checked_out", "reservation.no_show",
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
    triggers: ["system.scheduled", "system.check_in_reminder", "system.check_out_reminder"],
  },
]

const PHASE_META: Record<AutomationPhase, { label: string; description: string; icon: typeof Shield }> = {
  GUARD: { label: "Guard", description: "Block or flag reservations", icon: Shield },
  PRICE: { label: "Price", description: "Modify pricing and discounts", icon: DollarSign },
  ENFORCE: { label: "Enforce", description: "Require documents and deposits", icon: FileCheck },
  OPERATE: { label: "Operate", description: "Create work orders and assign staff", icon: Wrench },
  COMMUNICATE: { label: "Communicate", description: "Send emails, SMS, notifications", icon: Mail },
  LOG: { label: "Log", description: "Record activity and audit entries", icon: ScrollText },
}

// ============================================================================
// Types
// ============================================================================

type AutomationActionFormData = {
  id: string
  actionType: ActionType
  actionConfig: Record<string, unknown>
  delayValue: number | null
  delayUnit: DelayUnit | null
}

type AutomationFormPageClientProps = {
  mode: "create" | "edit"
  propertyId: string
  companyId: string
  automationId?: string
  systemMode?: boolean
  initialData?: {
    name: string
    description: string | null
    phase: AutomationPhase
    trigger_type: TriggerType
    is_active: boolean
    is_terminal: boolean
    sort_order: number
  }
}

// ============================================================================
// Component
// ============================================================================

export function AutomationFormPageClient({
  mode,
  propertyId,
  companyId,
  automationId,
  systemMode,
  initialData,
}: AutomationFormPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = mode === "edit"

  // ── Form state ─────────────────────────────────────────────────────────
  const [name, setName] = useState(initialData?.name ?? "")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [phase, setPhase] = useState<AutomationPhase>(initialData?.phase ?? "GUARD")
  const [triggerType, setTriggerType] = useState<TriggerType>(initialData?.trigger_type ?? "reservation.created")
  const [isActive, setIsActive] = useState(initialData?.is_active ?? false)
  const [isTerminal, setIsTerminal] = useState(initialData?.is_terminal ?? false)
  const [sortOrder, setSortOrder] = useState(initialData?.sort_order ?? 0)
  const [conditionGroups, setConditionGroups] = useState<ConditionGroupNode[]>([])
  const [actions, setActions] = useState<AutomationActionFormData[]>([])

  // ── UI state ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(isEdit && !initialData)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("details")
  const phaseInitialized = useRef(false)

  // ── Reset actions when phase changes ─────────────────────────────────
  useEffect(() => {
    if (phaseInitialized.current) {
      setActions([])
    }
    phaseInitialized.current = true
  }, [phase])

  // ── Load full automation data for edit ────────────────────────────────
  useEffect(() => {
    if (!isEdit || !automationId) return

    const fetchUrl = systemMode
      ? `/api/v1/automations/${automationId}`
      : `/api/v1/automations/${automationId}?propertyId=${propertyId}`

    fetch(fetchUrl)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(payload => {
        const data = payload.data ?? payload
        if (data.conditionGroups?.length) {
          setConditionGroups(hydrateTree(data.conditionGroups, data.conditions ?? []))
        }
        if (data.actions?.length) {
          setActions(data.actions.map((a: any) => ({
            id: a.id,
            actionType: a.action_type,
            actionConfig: a.action_config ?? {},
            delayValue: a.delay_value,
            delayUnit: a.delay_unit,
          })))
        }
      })
      .catch(() => {
        toast({ title: "Failed to load automation", variant: "destructive" })
        router.back()
      })
      .finally(() => setLoading(false))
  }, [isEdit, automationId, propertyId, systemMode, toast, router])

  // ── Navigate back ──────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (systemMode) {
      router.push(`/dashboard/${propertyId}/automations?tab=system-automations`)
    } else {
      router.push(`/dashboard/${propertyId}/automations?tab=automations`)
    }
  }, [router, propertyId, systemMode])

  // ── Validate ──────────────────────────────────────────────────────────
  const validate = useCallback((): string[] => {
    const errs: string[] = []
    if (!name.trim()) errs.push("Name is required")
    if (!triggerType) errs.push("Trigger type is required")
    if (isTerminal && phase !== "GUARD") errs.push("Terminal can only be set for GUARD phase")

    try {
      CreateAutomationSchema.parse({
        companyId,
        ...(systemMode ? {} : { propertyId }),
        name: name.trim(),
        description: description.trim() || undefined,
        phase,
        triggerType,
        isActive,
        isTerminal,
        sortOrder,
        ...(systemMode ? { scope: 'system' } : {}),
        conditionGroups: flattenTree(conditionGroups),
        actions: actions.map((a, _i) => ({
          actionType: a.actionType,
          actionConfig: Object.keys(a.actionConfig).length > 0 ? a.actionConfig : undefined,
          delayValue: a.delayValue,
          delayUnit: a.delayUnit,
          sortOrder: _i,
        })),
      })
    } catch (e: any) {
      const zodErrors = e?.errors?.map((err: any) => err.message) ?? []
      errs.push(...zodErrors.filter((m: string) => !errs.includes(m)))
    }

    return errs
  }, [name, description, phase, triggerType, isActive, isTerminal, sortOrder, conditionGroups, actions, companyId, propertyId, systemMode])

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const errs = validate()
    setErrors(errs)
    if (errs.length > 0) {
      toast({ title: "Validation errors", description: errs[0] ?? "", variant: "destructive" })
      setActiveTab("details")
      return
    }

    setSaving(true)
    try {
      const flatGroups = flattenTree(conditionGroups)
      const actionPayload = actions.map((a, _i) => ({
        actionType: a.actionType,
        actionConfig: Object.keys(a.actionConfig).length > 0 ? a.actionConfig : undefined,
        delayValue: a.delayValue,
        delayUnit: a.delayUnit,
        sortOrder: _i,
      }))

      const url = isEdit
        ? systemMode
          ? `/api/v1/automations/${automationId}`
          : `/api/v1/automations/${automationId}?propertyId=${propertyId}`
        : systemMode
          ? `/api/v1/automations`
          : `/api/v1/automations?propertyId=${propertyId}`

      const method = isEdit ? "PUT" : "POST"
      const body = isEdit
        ? {
          name: name.trim(),
          description: description.trim() || null,
          phase,
          triggerType,
          isActive,
          isTerminal,
          sortOrder,
          conditionGroups: flatGroups,
          actions: actionPayload,
        }
        : {
          companyId,
          ...(systemMode ? {} : { propertyId }),
          name: name.trim(),
          description: description.trim() || undefined,
          phase,
          triggerType,
          ...(systemMode ? { scope: 'system' } : {}),
          isActive,
          isTerminal,
          sortOrder,
          conditionGroups: flatGroups,
          actions: actionPayload,
        }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message ?? data.message ?? "Failed to save")
      }

      toast({
        title: isEdit ? "Automation updated" : "Automation created",
        variant: "success",
      })
      handleBack()
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message ?? "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [isEdit, automationId, propertyId, name, description, phase, triggerType, isActive, isTerminal, sortOrder, conditionGroups, actions, companyId, systemMode, validate, handleBack, toast])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isEdit
                ? systemMode ? "Edit System Automation" : "Edit Automation"
                : systemMode ? "New System Automation" : "New Automation"
              }
            </h1>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {isEdit
                  ? systemMode ? "Modify this system automation's configuration." : "Modify this automation's configuration."
                  : systemMode ? "Create a new automation rule for all properties." : "Create a new automation rule."
                }
              </p>
              {systemMode && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  This automation will run for every property.
                </p>
              )}
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {isEdit ? "Save Changes" : "Create Automation"}
        </Button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          {errors.join(" • ")}
        </div>
      )}

      {/* Tabs */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="details">
              Details
              {errors.length > 0 && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-destructive" />}
            </TabsTrigger>
            <TabsTrigger value="conditions">
              Conditions
              {conditionGroups.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 h-4">
                  {conditionGroups.reduce((sum, g) => sum + g.conditions.length, 0)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions">
              Actions
              {actions.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 h-4">
                  {actions.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Details Tab — Two-column layout ─────────────────────────── */}
          <TabsContent value="details" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: General */}
              <Card>
                <CardHeader className="pb-3 sm:pb-0">
                  <CardTitle className="text-base">General</CardTitle>
                  <CardDescription>Name, description, and execution order.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="automation-name">Name *</Label>
                    <Input
                      id="automation-name"
                      placeholder="e.g., Block High-Risk Reservations"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="automation-description">Description</Label>
                    <Textarea
                      id="automation-description"
                      placeholder="Optional description of what this automation does..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="automation-sort-order">Sort Order</Label>
                    <p className="text-xs text-muted-foreground">Lower values execute first within the same phase.</p>
                    <Input
                      id="automation-sort-order"
                      type="number"
                      min={0}
                      value={sortOrder}
                      onChange={e => setSortOrder(Number(e.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Right: Trigger & Settings */}
              <Card>
                <CardHeader className="pb-3 sm:pb-0">
                  <CardTitle className="text-base">Settings</CardTitle>
                  <CardDescription>Phase, trigger event, and status controls.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Phase */}
                  <div className="space-y-2">
                    <Label>
                      Phase
                      {isEdit && <span className="text-muted-foreground font-normal ml-1">(set on creation)</span>}
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PHASE_ORDER.map(p => {
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
                            onClick={() => !isEdit && setPhase(p)}
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
                    <Select value={triggerType} onValueChange={v => setTriggerType(v as TriggerType)}>
                      <SelectTrigger id="trigger-type">
                        <SelectValue placeholder="Select a trigger..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_GROUPS.map(group => (
                          <SelectGroup key={group.label}>
                            <SelectLabel>{group.label}</SelectLabel>
                            {group.triggers.map(trigger => (
                              <SelectItem key={trigger} value={trigger} className="font-mono text-xs">
                                {trigger}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status controls */}
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="automation-active">Active</Label>
                        <p className="text-xs text-muted-foreground">Enable or disable this automation.</p>
                      </div>
                      <Switch
                        id="automation-active"
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                    </div>
                  </div>

                  {/* Terminal Guard — GUARD phase only */}
                  {phase === "GUARD" ? (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="automation-terminal" className="text-red-600">Terminal Guard</Label>
                          <p className="text-xs text-muted-foreground">Blocks Price, Enforce, and Operate phases.</p>
                        </div>
                        <Switch
                          id="automation-terminal"
                          checked={isTerminal}
                          onCheckedChange={setIsTerminal}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Terminal Guard</Label>
                          <p className="text-xs text-muted-foreground">Only available for GUARD phase.</p>
                        </div>
                        <Badge variant="outline" className="text-xs text-red-600 border-red-500/20">GUARD only</Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Conditions Tab ──────────────────────────────────────────── */}
          <TabsContent value="conditions" className="mt-6">
            <ConditionsSection
              groups={conditionGroups}
              onChange={setConditionGroups}
              readOnly={false}
            />
          </TabsContent>

          {/* ── Actions Tab ─────────────────────────────────────────────── */}
          <TabsContent value="actions" className="mt-6">
            <ActionsSection
                actions={actions}
                phase={phase}
              onChange={setActions}
              propertyId={propertyId}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

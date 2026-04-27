'use client'

/**
 * Maintenance Site Type Config Settings Component
 *
 * Allows property owners to configure per-site-type maintenance defaults:
 * - Default categories for work orders
 * - Optional PM schedule to auto-link
 * - Optional checklist template
 *
 * @module components/dashboard/settings/maintenance-site-type-config
 */

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScheduleOption = {
  id: string
  name: string
}

type MaintenanceDefaultsForSiteType = {
  defaultCategories: string[]
  pmScheduleId: string | null
  checklistTemplate: string
}

type MaintenanceDefaults = Record<string, MaintenanceDefaultsForSiteType>

interface MaintenanceSiteTypeConfigProps {
  propertyId: string
  siteTypeConfig: Record<string, unknown>
  allowedSiteTypes: string[]
  canEdit?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAINTENANCE_CATEGORIES = [
  "electrical",
  "plumbing",
  "grounds",
  "facility",
  "cleaning",
  "hvac",
  "safety",
  "other",
] as const

const CATEGORY_LABELS: Record<string, string> = {
  electrical: "Electrical",
  plumbing: "Plumbing",
  grounds: "Grounds",
  facility: "Facility",
  cleaning: "Cleaning",
  hvac: "HVAC",
  safety: "Safety",
  other: "Other",
}

const EMPTY_DEFAULTS: MaintenanceDefaultsForSiteType = {
  defaultCategories: [],
  pmScheduleId: null,
  checklistTemplate: "",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MaintenanceSiteTypeConfig({
  propertyId,
  siteTypeConfig,
  allowedSiteTypes,
  canEdit = true,
}: MaintenanceSiteTypeConfigProps) {
  const router = useRouter()
  const [maintenanceDefaults, setMaintenanceDefaults] = useState<MaintenanceDefaults>({})
  const [selectedSiteType, setSelectedSiteType] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<ScheduleOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load initial state from site_type_config
  useEffect(() => {
    const existing = (siteTypeConfig as Record<string, unknown>)
      ?.maintenance_defaults as MaintenanceDefaults | undefined
    if (existing && typeof existing === "object") {
      setMaintenanceDefaults({ ...existing })
    }
    // Auto-select first site type if available
    if (allowedSiteTypes.length > 0) {
      setSelectedSiteType(allowedSiteTypes[0]!)
    }
  }, [siteTypeConfig, allowedSiteTypes])

  // Load PM schedules for the dropdown
  const loadSchedules = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/schedules`,
      )
      const payload = await res.json()
      if (payload?.success) {
        setSchedules(
          (payload.data?.schedules ?? []).map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
          })),
        )
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    void loadSchedules()
  }, [loadSchedules])

  // ---- Helpers ----

  const getCurrentDefaults = useCallback((): MaintenanceDefaultsForSiteType => {
    if (!selectedSiteType) return EMPTY_DEFAULTS
    return maintenanceDefaults[selectedSiteType] ?? { ...EMPTY_DEFAULTS }
  }, [selectedSiteType, maintenanceDefaults])

  const updateDefaults = useCallback(
    (patch: Partial<MaintenanceDefaultsForSiteType>) => {
      if (!selectedSiteType) return
      setMaintenanceDefaults((prev) => ({
        ...prev,
        [selectedSiteType]: {
          ...(prev[selectedSiteType] ?? { ...EMPTY_DEFAULTS }),
          ...patch,
        },
      }))
      setHasChanges(true)
    },
    [selectedSiteType],
  )

  const toggleCategory = useCallback(
    (category: string) => {
      const current = getCurrentDefaults()
      const updated = current.defaultCategories.includes(category)
        ? current.defaultCategories.filter((c) => c !== category)
        : [...current.defaultCategories, category]
      updateDefaults({ defaultCategories: updated })
    },
    [getCurrentDefaults, updateDefaults],
  )

  // ---- Save ----

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const mergedConfig = {
        ...(siteTypeConfig as Record<string, unknown>),
        maintenance_defaults: maintenanceDefaults,
      }

      const res = await fetch(`/api/properties/${propertyId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_type_config: mergedConfig }),
      })

      if (!res.ok) {
        throw new Error("Failed to save maintenance defaults")
      }

      toast.success("Maintenance defaults saved")
      setHasChanges(false)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save"
      toast.error("Save failed", { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  // ---- Render ----

  const current = getCurrentDefaults()
  const readOnly = !canEdit

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Maintenance Defaults by Site Type</CardTitle>
          <CardDescription>
            Configure default categories, PM schedule, and checklist template for each site type. These defaults will be applied when creating maintenance work orders for sites of that type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {allowedSiteTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No site types configured yet. Add site types in the Site Types Rates tab first.
            </p>
          ) : (
            <>
              {/* Site type selector */}
              <div className="space-y-2">
                <Label>Site Type</Label>
                <Select
                  value={selectedSiteType ?? ""}
                  onValueChange={setSelectedSiteType}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-9 w-full sm:w-64">
                    <SelectValue placeholder="Select a site type" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedSiteTypes.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st.charAt(0).toUpperCase() + st.slice(1).replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Config form for selected site type */}
              {selectedSiteType && (
                <div className="space-y-5 rounded-md border p-4">
                  {/* Default Categories */}
                  <div className="space-y-2">
                    <Label>Default Categories</Label>
                    <p className="text-xs text-muted-foreground">
                      Select the categories that should be pre-selected for work orders on this site type.
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {MAINTENANCE_CATEGORIES.map((cat) => {
                        const checked = current.defaultCategories.includes(cat)
                        return (
                          <label
                            key={cat}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCategory(cat)}
                              disabled={readOnly}
                              className="h-4 w-4 rounded border-border"
                            />
                            {CATEGORY_LABELS[cat] ?? cat}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* PM Schedule */}
                  <div className="space-y-2">
                    <Label>PM Schedule (Optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Link a preventive maintenance schedule to this site type. New WOs will be associated with this schedule.
                    </p>
                    {isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading schedules…
                      </div>
                    ) : (
                      <Select
                        value={current.pmScheduleId ?? "__none__"}
                        onValueChange={(v) =>
                          updateDefaults({
                            pmScheduleId: v === "__none__" ? null : v,
                          })
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-9 w-full sm:w-80">
                          <SelectValue placeholder="Select a schedule" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">(None)</SelectItem>
                          {schedules.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Checklist Template */}
                  <div className="space-y-2">
                    <Label htmlFor="checklist-template">Checklist Template (Optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Free-text checklist that will be included when creating work orders for this site type. One item per line.
                    </p>
                    <textarea
                      id="checklist-template"
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={"- Check breaker panel\n- Inspect outlets\n- Test GFCI receptacles"}
                      value={current.checklistTemplate}
                      onChange={(e) => updateDefaults({ checklistTemplate: e.target.value })}
                      disabled={readOnly}
                      rows={5}
                    />
                  </div>
                </div>
              )}

              {/* Save button */}
              {canEdit && hasChanges && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Defaults
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

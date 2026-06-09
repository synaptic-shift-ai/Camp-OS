'use client'

/**
 * Reservation Type Settings Component
 *
 * Allows property owners to configure:
 * - Enabled reservation types (Nightly, Weekly, Monthly, Seasonal)
 * - Min/max night constraints for each type
 * - Seasonal periods with base rates
 *
 * @module components/dashboard/settings/reservation-type-settings
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { useDialogCloseGuard } from '@/hooks/use-dialog-close-guard'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Info, Plus, Pencil, Trash2 } from 'lucide-react'
import type { PropertyReservationTypesConfig, SeasonalPeriod, BookingType } from '@/lib/config/types'
import { DEFAULT_RESERVATION_TYPES_CONFIG } from '@/lib/config/types'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ReservationTypeSettingsProps {
  propertyId: string
  initialConfig?: PropertyReservationTypesConfig
  initialEnabledTypes?: BookingType[]
  initialSeasonalPeriods?: SeasonalPeriod[]
  initialSiteTypes?: { siteType: string }[]
  initialAllowedSiteTypes?: string[]
  initialSiteTypeRates?: Record<string, {
    nightly?: Partial<SiteTypeRateConfig>
    weekly?: Partial<SiteTypeRateConfig>
    monthly?: Partial<SiteTypeRateConfig>
  }>
  initialSiteTypeConfig?: Record<string, unknown> | null
  canEdit?: boolean
}

/** Order for accordion; values must match DB site_type (case-insensitive). */
const SITE_TYPE_DISPLAY_ORDER: string[] = [
  'RV',
  'Tent',
  'Cabin',
  'Glamping',
  'Yurt',
  'Other',
]

// All possible site types that can be configured for a property.
// Values should correspond to the DB `site_type` values (case-insensitive).
const ALL_SITE_TYPES = SITE_TYPE_DISPLAY_ORDER

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

type ConfigurableReservationType = 'nightly' | 'weekly' | 'monthly' | 'seasonal'

type SiteTypeRateConfig = {
  rate_cents: number | null
  min_nights: number
  max_nights: number | null
}

const RESERVATION_TYPE_LABELS: Record<ConfigurableReservationType, { title: string; description: string }> = {
  nightly: {
    title: 'Nightly',
    description: 'Short stays charged per night (1-6 nights default)',
  },
  weekly: {
    title: 'Weekly',
    description: 'Week-long stays with potential discounts (7-27 nights default)',
  },
  monthly: {
    title: 'Monthly',
    description: 'Extended stays of 28+ nights with monthly rates',
  },
  seasonal: {
    title: 'Seasonal',
    description: 'Fixed date range stays with flat rates',
  },
}

interface SeasonalPeriodFormData {
  id?: string
  name: string
  start_month: number
  start_day: number
  end_month: number
  end_day: number
  base_rate_cents: number
  recurring: boolean
}

const SEASON_ERROR_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function SiteTypeRateSettings({
  propertyId,
  initialConfig,
  initialEnabledTypes,
  initialSeasonalPeriods,
  initialSiteTypes = [],
  initialAllowedSiteTypes,
  initialSiteTypeRates,
  initialSiteTypeConfig = null,
  canEdit = true,
}: ReservationTypeSettingsProps) {
  const readOnly = !canEdit
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  // Configuration state
  const [config, setConfig] = useState<PropertyReservationTypesConfig>(
    initialConfig || DEFAULT_RESERVATION_TYPES_CONFIG
  )
  const [enabledTypes, setEnabledTypes] = useState<BookingType[]>(
    initialEnabledTypes || ['nightly', 'weekly', 'monthly']
  )

  // Seasonal periods state
  const [seasonalPeriods, setSeasonalPeriods] = useState<SeasonalPeriod[]>(
    initialSeasonalPeriods || []
  )
  const [isSeasonDialogOpen, setIsSeasonDialogOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<SeasonalPeriodFormData | null>(null)
  const [seasonFormError, setSeasonFormError] = useState<string | null>(null)
  const [isSeasonSaving, setIsSeasonSaving] = useState(false)
  const cleanPeriodFormRef = useRef<string>("")

  useEffect(() => {
    if (!isSeasonDialogOpen) return
    cleanPeriodFormRef.current = JSON.stringify(editingPeriod)
  }, [isSeasonDialogOpen, editingPeriod])

  // Track if form is dirty
  const [isDirty, setIsDirty] = useState(false)
  const [focusedRateField, setFocusedRateField] = useState<'nightly' | 'weekly' | 'monthly' | null>(null)
  const [rateInputValue, setRateInputValue] = useState<string>('')

  const [siteTypeRates, setSiteTypeRates] = useState<
    Record<string, { nightly: SiteTypeRateConfig; weekly: SiteTypeRateConfig; monthly: SiteTypeRateConfig }>
  >(() => {
    const fromConfig: Record<
        string,
        {
        nightly?: Partial<SiteTypeRateConfig>
        weekly?: Partial<SiteTypeRateConfig>
        monthly?: Partial<SiteTypeRateConfig>
        }
    > = initialSiteTypeRates ?? {}

    return (initialSiteTypes ?? []).reduce(
      (acc, { siteType }) => {
        const cfg = fromConfig[siteType] ?? {}
        
        acc[siteType] = {
          nightly: {
            rate_cents: cfg.nightly?.rate_cents ?? null,
            min_nights: cfg.nightly?.min_nights ?? 1,
            max_nights: cfg.nightly?.max_nights ?? 6,
          },
          weekly: {
            rate_cents: cfg.weekly?.rate_cents ?? null,
            min_nights: cfg.weekly?.min_nights ?? 7,
            max_nights: cfg.weekly?.max_nights ?? 27,
          },
          monthly: {
            rate_cents: cfg.monthly?.rate_cents ?? null,
            min_nights: cfg.monthly?.min_nights ?? 28,
            max_nights: cfg.monthly?.max_nights ?? null,
          },
        }
        return acc
      },
      {} as Record<string, { nightly: SiteTypeRateConfig; weekly: SiteTypeRateConfig; monthly: SiteTypeRateConfig }>
    )
  })
  const [focusedSiteTypeRateField, setFocusedSiteTypeRateField] = useState<string | null>(null)
  const [siteRateInputValue, setSiteRateInputValue] = useState<string>('')
  const toSiteTypeKey = (siteType: string) => siteType.trim().toLowerCase()

  // Site types currently selected for this property. This should correspond
  // to the `allowed_site_types` entry in the `site_type_config` JSON column.
  const [allowedSiteTypes, setAllowedSiteTypes] = useState<string[]>(
    initialAllowedSiteTypes && initialAllowedSiteTypes.length > 0
      ? initialAllowedSiteTypes
      : (initialSiteTypes ?? []).map(({ siteType }) => siteType)
  )

  const [maintenanceBySiteType, setMaintenanceBySiteType] = useState<Record<string, boolean>>(() => {
    const existing =
      (initialSiteTypeConfig as { maintenance?: Record<string, boolean> } | null)?.maintenance ?? {}
    const next: Record<string, boolean> = {}
    ;(initialAllowedSiteTypes && initialAllowedSiteTypes.length > 0
      ? initialAllowedSiteTypes
      : (initialSiteTypes ?? []).map(({ siteType }) => siteType)
    ).forEach((siteType) => {
      const key = toSiteTypeKey(siteType)
      next[key] = existing[key] ?? true
    })
    return next
  })

  const [housekeepingBySiteType, setHousekeepingBySiteType] = useState<Record<string, boolean>>(() => {
    const existing =
      (initialSiteTypeConfig as { housekeeping?: Record<string, boolean> } | null)?.housekeeping ?? {}
    const next: Record<string, boolean> = {}
    ;(initialAllowedSiteTypes && initialAllowedSiteTypes.length > 0
      ? initialAllowedSiteTypes
      : (initialSiteTypes ?? []).map(({ siteType }) => siteType)
    ).forEach((siteType) => {
      const key = toSiteTypeKey(siteType)
      next[key] = existing[key] ?? true
    })
    return next
  })

  // Options for the "Add Site Type" dropdown – only show site types that
  // have not already been added/selected for this property.
  const availableSiteTypeOptions = ALL_SITE_TYPES.filter((siteTypeName) => {
    const normalized = siteTypeName.trim().toLowerCase()
    return !allowedSiteTypes.some((t) => t.trim().toLowerCase() === normalized)
  })

  const toggleReservationType = (type: ConfigurableReservationType) => {
    const isEnabled = enabledTypes.includes(type)
    if (isEnabled) {
      setEnabledTypes(enabledTypes.filter((t) => t !== type))
    } else {
      setEnabledTypes([...enabledTypes, type])
    }

    // Update config enabled state
    setConfig((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        enabled: !isEnabled,
      },
    }))
    setIsDirty(true)
  }

  const updateTypeConfig = (
    type: 'nightly' | 'weekly' | 'monthly',
    field: 'min_nights' | 'max_nights' | 'rate_cents',
    value: number | null
  ) => {
    setConfig((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }))
    setIsDirty(true)
  }

  const updateSiteTypeConfig = (
    siteType: string,
    type: 'nightly' | 'weekly' | 'monthly',
    field: keyof SiteTypeRateConfig,
    value: number | null
  ) => {
    setSiteTypeRates((prev) => {
      const current = prev[siteType]
      const currentType = current?.[type]
      const defaultMin =
        type === 'nightly' ? 1 : type === 'weekly' ? 7 : 28
      const defaultMax =
        type === 'nightly' ? 6 : type === 'weekly' ? 27 : null
      const nextType: SiteTypeRateConfig = {
        rate_cents: currentType?.rate_cents ?? null,
        min_nights: currentType?.min_nights ?? defaultMin,
        max_nights: currentType?.max_nights ?? defaultMax,
        [field]: value,
      }
      return {
        ...prev,
        [siteType]: {
          nightly: current?.nightly ?? {
            rate_cents: null,
            min_nights: 1,
            max_nights: 6,
          },
          weekly: current?.weekly ?? {
            rate_cents: null,
            min_nights: 7,
            max_nights: 27,
          },
          monthly: current?.monthly ?? {
            rate_cents: null,
            min_nights: 28,
            max_nights: null,
          },
          [type]: nextType,
        },
      }
    })
    setIsDirty(true)
  }

  const parseDollarsToCents = (dollars: string): number | null => {
    const parsed = parseFloat(dollars)
    if (isNaN(parsed) || parsed < 0) return null
    return Math.round(parsed * 100)
  }

  const formatCentsToInput = (cents: number | null | undefined): string => {
    if (cents === null || cents === undefined) return ''
    return (cents / 100).toFixed(2)
  }

  const handleSaveConfig = async () => {
    setIsSaving(true)

    try {
      const response = await fetch(`/api/properties/${propertyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_type_config: {
            ...(initialSiteTypeConfig ?? {}),
            allowed_site_types: allowedSiteTypes,
            site_type_rates: siteTypeRates,
            maintenance: Object.fromEntries(
              allowedSiteTypes.map((siteType) => {
                const key = toSiteTypeKey(siteType)
                return [key, maintenanceBySiteType[key] ?? false]
              })
            ),
            housekeeping: Object.fromEntries(
              allowedSiteTypes.map((siteType) => {
                const key = toSiteTypeKey(siteType)
                return [key, housekeepingBySiteType[key] ?? false]
              })
            ),
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to save site type rates')
      }

      toast({
        title: 'Site type rates saved',
        description: 'Site type rates saved successfully.',
        variant: "success",
      })
      setIsDirty(false)
      router.refresh()
    } catch (error) {
      console.error('Error saving site type rates:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save site type rates',
        variant: 'destructive',
        className: SEASON_ERROR_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const { UnsavedChangesDialog } = useUnsavedChangesGuard(isDirty, {
    onSave: handleSaveConfig,
    message: 'You have unsaved changes to site type rates.',
  })

  const periodDialogIsDirty = isSeasonDialogOpen && editingPeriod !== null && JSON.stringify(editingPeriod) !== cleanPeriodFormRef.current

  const { guardedOnOpenChange: guardedSeasonDialogOpenChange, unsavedChangesDialog: seasonUnsavedChangesDialog } = useDialogCloseGuard({
    isDirty: periodDialogIsDirty,
    open: isSeasonDialogOpen,
    onOpenChange: setIsSeasonDialogOpen,
  })

  const handleSaveSeasonalPeriod = async () => {
    if (!editingPeriod) return

    // Validate
    if (!editingPeriod.name.trim()) {
      setSeasonFormError('Season name is required')
      return
    }
    if (editingPeriod.base_rate_cents <= 0) {
      setSeasonFormError('Base rate must be greater than $0')
      return
    }

    setIsSeasonSaving(true)
    setSeasonFormError(null)

    try {
      const isEditing = !!editingPeriod.id
      const url = isEditing
        ? `/api/v1/properties/${propertyId}/seasonal-periods/${editingPeriod.id}`
        : `/api/v1/properties/${propertyId}/seasonal-periods`

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingPeriod.name,
          start_month: editingPeriod.start_month,
          start_day: editingPeriod.start_day,
          end_month: editingPeriod.end_month,
          end_day: editingPeriod.end_day,
          base_rate_cents: editingPeriod.base_rate_cents,
          recurring: editingPeriod.recurring,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to save seasonal period')
      }

      const { data: savedPeriod } = await response.json()

      if (isEditing) {
        setSeasonalPeriods((prev) =>
          prev.map((p) => (p.id === editingPeriod.id ? savedPeriod : p))
        )
      } else {
        setSeasonalPeriods((prev) => [...prev, savedPeriod])
      }

      setIsSeasonDialogOpen(false)
      setEditingPeriod(null)
    } catch (error) {
      console.error('Error saving seasonal period:', error)
      setSeasonFormError(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setIsSeasonSaving(false)
    }
  }

  const handleDeleteSeasonalPeriod = async (periodId: string) => {
    if (!confirm('Are you sure you want to delete this seasonal period?')) return

    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/seasonal-periods/${periodId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete seasonal period')
      }

      setSeasonalPeriods((prev) => prev.filter((p) => p.id !== periodId))
    } catch (error) {
      console.error('Error deleting seasonal period:', error)
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
        className: SEASON_ERROR_TOAST_CLASS,
      })
    }
  }

  const formatMonthDay = (month: number, day: number) => {
    return `${MONTHS.find((m) => m.value === month)?.label.slice(0, 3)} ${day}`
  }

  const formatCentsToDollars = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const orderedSiteTypes = allowedSiteTypes
    .map((siteType) => ({ siteType }))
    .sort((a, b) => {
      const norm = (s: string) => s.trim().toLowerCase()
      const indexA = SITE_TYPE_DISPLAY_ORDER.findIndex(
        (ordered) => norm(ordered) === norm(a.siteType)
      )
      const indexB = SITE_TYPE_DISPLAY_ORDER.findIndex(
        (ordered) => norm(ordered) === norm(b.siteType)
      )
      const orderA = indexA === -1 ? SITE_TYPE_DISPLAY_ORDER.length : indexA
      const orderB = indexB === -1 ? SITE_TYPE_DISPLAY_ORDER.length : indexB
      return orderA - orderB
    })

  return (
    <>
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-1.5">
                        <CardTitle className="text-xl sm:text-2xl">Your Site Types</CardTitle>
                        <CardDescription className="text-pretty">
                        Select which site types your property offers
                        </CardDescription>
                    </div>
                    {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full shrink-0 sm:w-auto">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Site Type
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {availableSiteTypeOptions.length === 0 ? (
                          <DropdownMenuItem disabled>
                            All site types have been added
                          </DropdownMenuItem>
                        ) : (
                          availableSiteTypeOptions.map((siteTypeName) => (
                            <DropdownMenuItem
                              key={siteTypeName}
                              onClick={() => {
                                setAllowedSiteTypes((prev) => [...prev, siteTypeName])
                                setMaintenanceBySiteType((prev) => ({
                                  ...prev,
                                  [toSiteTypeKey(siteTypeName)]:
                                    prev[toSiteTypeKey(siteTypeName)] ?? true,
                                }))
                                setHousekeepingBySiteType((prev) => ({
                                  ...prev,
                                  [toSiteTypeKey(siteTypeName)]:
                                    prev[toSiteTypeKey(siteTypeName)] ?? true,
                                }))
                                setSiteTypeRates((prev) =>
                                  prev[siteTypeName]
                                    ? prev
                                    : {
                                        ...prev,
                                        [siteTypeName]: {
                                          nightly: {
                                            rate_cents: null,
                                            min_nights: 1,
                                            max_nights: 6,
                                          },
                                          weekly: {
                                            rate_cents: null,
                                            min_nights: 7,
                                            max_nights: 27,
                                          },
                                          monthly: {
                                            rate_cents: null,
                                            min_nights: 28,
                                            max_nights: null,
                                          },
                                        },
                                      }
                                )
                                setIsDirty(true)
                              }}
                            >
                              {siteTypeName} Site
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                </div>
            </CardHeader>
            <CardContent>
              {allowedSiteTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No site types selected. Use &quot;Add Site Type&quot; to choose which site
                  types this property offers.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allowedSiteTypes.map((siteType) => (
                    <div
                      key={siteType}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border bg-muted px-3 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">{siteType} Site</span>
                      {canEdit && (
                      <button
                        type="button"
                        className="shrink-0 touch-manipulation text-xs text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${siteType} site type`}
                        onClick={() => {
                          setAllowedSiteTypes((prev) =>
                            prev.filter((t) => t !== siteType)
                          )
                          setMaintenanceBySiteType((prev) => {
                            const next = { ...prev }
                            delete next[toSiteTypeKey(siteType)]
                            return next
                          })
                          setHousekeepingBySiteType((prev) => {
                            const next = { ...prev }
                            delete next[toSiteTypeKey(siteType)]
                            return next
                          })
                          setIsDirty(true)
                        }}
                      >
                        ×
                      </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
        </Card>
        
        <div className="space-y-1.5">
          <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">Rate Configuration</h3>
          <p className="text-sm text-muted-foreground text-pretty">
            Set nightly, weekly, and monthly rates for each site type
          </p>
        </div>

        {initialSiteTypes.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No site types found for this property.</p>
                <p className="text-sm">
                  Add sites from the Sites page to configure rates by site type.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {orderedSiteTypes.map(({ siteType }) => {
              const rates = siteTypeRates[siteType] ?? {
                nightly: {
                  rate_cents: null,
                  min_nights: 1,
                  max_nights: 6,
                },
                weekly: {
                  rate_cents: null,
                  min_nights: 7,
                  max_nights: 27,
                },
                monthly: {
                  rate_cents: null,
                  min_nights: 28,
                  max_nights: null,
                },
              }

              return (
                <Card key={siteType} className="overflow-hidden">
                  <Accordion type="single" collapsible>
                    <AccordionItem value={siteType} className="border-b-0">
                      <AccordionTrigger className="px-4 py-3.5 text-left sm:px-6 sm:py-4">
                        {siteType.charAt(0).toUpperCase() + siteType.slice(1)} Site
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 px-4 pb-4 pt-0 sm:space-y-6 sm:px-6 sm:pb-6">
                        {(['nightly', 'weekly', 'monthly'] as const).map((type) => (
                          <div
                            key={type}
                            className="grid gap-4 border-l-2 border-muted pl-3 sm:pl-4 md:grid-cols-3"
                          >
                            <div className="space-y-2">
                              <Label htmlFor={`${siteType}-${type}-rate`}>
                                {type === 'nightly'
                                  ? 'Nightly Rate'
                                  : `${RESERVATION_TYPE_LABELS[type].title} Rate`}
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  $
                                </span>
                                <Input
                                  id={`${siteType}-${type}-rate`}
                                  type="number"
                                  step="1"
                                  min="0"
                                  className="pl-7"
                                  placeholder="Enter rate"
                                  disabled={readOnly}
                                  value={
                                    focusedSiteTypeRateField === `${siteType}-${type}`
                                      ? siteRateInputValue
                                      : formatCentsToInput(rates[type].rate_cents)
                                  }
                                  onFocus={() => {
                                    setFocusedSiteTypeRateField(`${siteType}-${type}`)
                                    setSiteRateInputValue(
                                      formatCentsToInput(rates[type].rate_cents)
                                    )
                                  }}
                                  onChange={(e) => setSiteRateInputValue(e.target.value)}
                                  onBlur={() => {
                                    const cents = parseDollarsToCents(siteRateInputValue)
                                    updateSiteTypeConfig(
                                      siteType,
                                      type,
                                      'rate_cents',
                                      cents ?? null
                                    )
                                    setFocusedSiteTypeRateField(null)
                                  }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {type === 'nightly' && 'Base rate per night for short stays'}
                                {type === 'weekly' &&
                                  `Weekly rate for every ${rates.weekly.min_nights} night stay`}
                                {type === 'monthly' &&
                                  `Monthly rate for every ${rates.monthly.min_nights} night stay`}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${siteType}-${type}-min`}>Minimum Nights</Label>
                              <Input
                                id={`${siteType}-${type}-min`}
                                type="number"
                                min="1"
                                max="365"
                                disabled={readOnly}
                                value={rates[type].min_nights}
                                onChange={(e) =>
                                  updateSiteTypeConfig(
                                    siteType,
                                    type,
                                    'min_nights',
                                    parseInt(e.target.value) || 1
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${siteType}-${type}-max`}>Maximum Nights</Label>
                              <Input
                                id={`${siteType}-${type}-max`}
                                type="number"
                                min="1"
                                max="365"
                                placeholder="No limit"
                                disabled={readOnly}
                                value={rates[type].max_nights ?? ''}
                                onChange={(e) =>
                                  updateSiteTypeConfig(
                                    siteType,
                                    type,
                                    'max_nights',
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              )
            })}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Maintenance & Housekeeping Configuration</CardTitle>
            <CardDescription>
              Check a site type to make it available for maintenance or housekeeping assignment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Maintenance</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {orderedSiteTypes.map(({ siteType }) => (
                    <label
                      key={`maintenance-${siteType}`}
                      className="flex items-center gap-2 rounded-md border p-2 text-sm"
                    >
                      <Checkbox
                        disabled={readOnly}
                        checked={maintenanceBySiteType[toSiteTypeKey(siteType)] ?? false}
                        onCheckedChange={(checked) => {
                          setMaintenanceBySiteType((prev) => ({
                            ...prev,
                            [toSiteTypeKey(siteType)]: checked === true,
                          }))
                          setIsDirty(true)
                        }}
                      />
                      <span className="text-muted-foreground">{siteType} Site</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Housekeeping</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {orderedSiteTypes.map(({ siteType }) => (
                    <label
                      key={`housekeeping-${siteType}`}
                      className="flex items-center gap-2 rounded-md border p-2 text-sm"
                    >
                      <Checkbox
                        disabled={readOnly}
                        checked={housekeepingBySiteType[toSiteTypeKey(siteType)] ?? false}
                        onCheckedChange={(checked) => {
                          setHousekeepingBySiteType((prev) => ({
                            ...prev,
                            [toSiteTypeKey(siteType)]: checked === true,
                          }))
                          setIsDirty(true)
                        }}
                      />
                      <span className="text-muted-foreground">{siteType} Site</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Save Button and Messages */}
      {canEdit && (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          onClick={handleSaveConfig}
          disabled={isSaving || !isDirty}
          className="w-full shrink-0 sm:w-auto"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Site Type Rates'}
        </Button>
      </div>
      )}

      {/* Seasonal Period Dialog */}
      {canEdit && (
      <Dialog open={isSeasonDialogOpen} onOpenChange={guardedSeasonDialogOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingPeriod?.id ? 'Edit Seasonal Period' : 'Add Seasonal Period'}
            </DialogTitle>
            <DialogDescription>
              Define the date range and base rate for this season.
            </DialogDescription>
          </DialogHeader>

          {editingPeriod && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="season-name">Season Name</Label>
                <Input
                  id="season-name"
                  placeholder="e.g., Summer Peak, Winter Season"
                  value={editingPeriod.name}
                  onChange={(e) =>
                    setEditingPeriod({ ...editingPeriod, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={String(editingPeriod.start_month)}
                      onValueChange={(v) =>
                        setEditingPeriod({ ...editingPeriod, start_month: parseInt(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-[220px]">
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={String(m.value)}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={editingPeriod.start_day}
                      onChange={(e) =>
                        setEditingPeriod({
                          ...editingPeriod,
                          start_day: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={String(editingPeriod.end_month)}
                      onValueChange={(v) =>
                        setEditingPeriod({ ...editingPeriod, end_month: parseInt(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-[220px]">
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={String(m.value)}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={editingPeriod.end_day}
                      onChange={(e) =>
                        setEditingPeriod({
                          ...editingPeriod,
                          end_day: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="base-rate">Base Rate (flat rate for entire season)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="base-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-7"
                    value={(editingPeriod.base_rate_cents / 100).toFixed(2)}
                    onChange={(e) =>
                      setEditingPeriod({
                        ...editingPeriod,
                        base_rate_cents: Math.round(parseFloat(e.target.value || '0') * 100),
                      })
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  This is the total price for the season, not per night
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="recurring"
                  checked={editingPeriod.recurring}
                  onCheckedChange={(checked) =>
                    setEditingPeriod({ ...editingPeriod, recurring: checked })
                  }
                />
                <Label htmlFor="recurring">Recurring annually</Label>
              </div>

              {seasonFormError && (
                <Alert variant="destructive">
                  <AlertDescription>{seasonFormError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => guardedSeasonDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSeasonalPeriod} disabled={isSeasonSaving}>
              {isSeasonSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPeriod?.id ? 'Save Changes' : 'Add Season'}
            </Button>
          </DialogFooter>
        </DialogContent>
        {seasonUnsavedChangesDialog}
      </Dialog>
      )}
    </div>
    <UnsavedChangesDialog />
    </>
  )
}

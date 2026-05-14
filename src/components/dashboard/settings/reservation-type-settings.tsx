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

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
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

interface ReservationTypeSettingsProps {
  propertyId: string
  initialConfig?: PropertyReservationTypesConfig
  initialEnabledTypes?: BookingType[]
  initialSeasonalPeriods?: SeasonalPeriod[]
  canEdit?: boolean
}

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

export function ReservationTypeSettings({
  propertyId,
  initialConfig,
  initialEnabledTypes,
  initialSeasonalPeriods,
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

  // Track if form is dirty
  const [isDirty, setIsDirty] = useState(false)
  const [focusedRateField, setFocusedRateField] = useState<'nightly' | 'weekly' | 'monthly' | null>(null)
  const [rateInputValue, setRateInputValue] = useState<string>('')

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
      const response = await fetch(`/api/v1/properties/${propertyId}/reservation-types`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled_reservation_types: enabledTypes,
          reservation_type_config: config,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to save reservation type settings')
      }

      toast({
        title: 'Reservation types saved',
        description: 'Reservation type settings saved successfully.',
        variant: "success",
      })
      setIsDirty(false)
      router.refresh()
    } catch (error) {
      console.error('Error saving reservation type settings:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
        className: SEASON_ERROR_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const { UnsavedChangesDialog } = useUnsavedChangesGuard(isDirty, {
    onSave: handleSaveConfig,
    message: 'You have unsaved changes to reservation type settings.',
  })

  // Seasonal period handlers
  const openAddSeasonDialog = () => {
    setEditingPeriod({
      name: '',
      start_month: 6,
      start_day: 1,
      end_month: 8,
      end_day: 31,
      base_rate_cents: 0,
      recurring: true,
    })
    setSeasonFormError(null)
    setIsSeasonDialogOpen(true)
  }

  const openEditSeasonDialog = (period: SeasonalPeriod) => {
    setEditingPeriod({
      id: period.id,
      name: period.name,
      start_month: period.start_month,
      start_day: period.start_day,
      end_month: period.end_month,
      end_day: period.end_day,
      base_rate_cents: period.base_rate_cents,
      recurring: period.recurring,
    })
    setSeasonFormError(null)
    setIsSeasonDialogOpen(true)
  }

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

  return (
    <>
    <div className="space-y-6">
      {/* Reservation Types Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Reservation Types</CardTitle>
          <CardDescription>
            Configure which reservation types are available and their stay duration rules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(['nightly', 'weekly', 'monthly', 'seasonal'] as const).map((type) => (
            <div
              key={type}
              className="flex flex-col space-y-4 pb-6 border-b last:border-b-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{RESERVATION_TYPE_LABELS[type].title}</Label>
                  <p className="text-sm text-muted-foreground">
                    {RESERVATION_TYPE_LABELS[type].description}
                  </p>
                </div>
                <Switch
                  checked={enabledTypes.includes(type)}
                  disabled={readOnly}
                  onCheckedChange={() => toggleReservationType(type)}
                />
              </div>

              {/* Configuration for non-seasonal types */}
              {enabledTypes.includes(type) && type !== 'seasonal' && (
                <div className="grid gap-4 md:grid-cols-3 pl-4 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label htmlFor={`${type}-rate`}>
                      {type === 'nightly' ? 'Nightly Rate' : `${RESERVATION_TYPE_LABELS[type].title} Rate`}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id={`${type}-rate`}
                        type="number"
                        step="1"
                        min="0"
                        className="pl-7"
                        placeholder="Enter rate"
                        disabled={readOnly}
                        value={
                          focusedRateField === type
                            ? rateInputValue
                            : formatCentsToInput(config[type].rate_cents)
                        }
                        onFocus={() => {
                          setFocusedRateField(type)
                          setRateInputValue(formatCentsToInput(config[type].rate_cents))
                        }}
                        onChange={(e) => setRateInputValue(e.target.value)}
                        onBlur={() => {
                          const cents = parseDollarsToCents(rateInputValue)
                          updateTypeConfig(type, 'rate_cents', cents ?? config[type].rate_cents ?? 0)
                          setFocusedRateField(null)
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {type === 'nightly' && 'Base rate per night for short stays'}
                      {type === 'weekly' && `Weekly rate for every ${config.weekly.min_nights} night stay`}
                      {type === 'monthly' && `Monthly rate for every ${config.monthly.min_nights} night stay`}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${type}-min`}>Minimum Nights</Label>
                    <Input
                      id={`${type}-min`}
                      type="number"
                      min="1"
                      max="365"
                      disabled={readOnly}
                      value={config[type].min_nights}
                      onChange={(e) =>
                        updateTypeConfig(type, 'min_nights', parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${type}-max`}>Maximum Nights</Label>
                    <Input
                      id={`${type}-max`}
                      type="number"
                      min="1"
                      max="365"
                      placeholder="No limit"
                      disabled={readOnly}
                      value={config[type].max_nights ?? ''}
                      onChange={(e) =>
                        updateTypeConfig(
                          type,
                          'max_nights',
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {/* Seasonal type info */}
              {enabledTypes.includes(type) && type === 'seasonal' && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Seasonal reservations use flat rates for defined date ranges. Configure
                    seasonal periods below.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Seasonal Periods */}
      {enabledTypes.includes('seasonal') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Seasonal Periods</CardTitle>
              <CardDescription>
                Define date ranges and base rates for seasonal reservations
              </CardDescription>
            </div>
            <Button onClick={openAddSeasonDialog} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Season
            </Button>
          </CardHeader>
          <CardContent>
            {seasonalPeriods.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No seasonal periods configured.</p>
                <p className="text-sm">Add a season to enable seasonal bookings.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Season Name</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Base Rate</TableHead>
                    <TableHead>Recurring</TableHead>
                    {canEdit && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasonalPeriods.map((period) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium">{period.name}</TableCell>
                      <TableCell>
                        {formatMonthDay(period.start_month, period.start_day)} -{' '}
                        {formatMonthDay(period.end_month, period.end_day)}
                      </TableCell>
                      <TableCell>{formatCentsToDollars(period.base_rate_cents)}</TableCell>
                      <TableCell>{period.recurring ? 'Yes' : 'No'}</TableCell>
                      {canEdit && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditSeasonDialog(period)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSeasonalPeriod(period.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Button and Messages */}
      {canEdit && (
      <div className="flex items-center justify-between">
        <Button onClick={handleSaveConfig} disabled={isSaving || !isDirty}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Reservation Types'}
        </Button>
      </div>
      )}

      {/* Seasonal Period Dialog */}
      {canEdit && (
      <Dialog open={isSeasonDialogOpen} onOpenChange={setIsSeasonDialogOpen}>
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
                      <SelectContent>
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
                      <SelectContent>
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
            <Button variant="outline" onClick={() => setIsSeasonDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSeasonalPeriod} disabled={isSeasonSaving}>
              {isSeasonSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPeriod?.id ? 'Save Changes' : 'Add Season'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
    <UnsavedChangesDialog />
    </>
  )
}

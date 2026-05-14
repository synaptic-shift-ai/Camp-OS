'use client'

/**
 * Booking Rules Configuration Settings Component
 *
 * Allows property owners to configure:
 * - Minimum and maximum stay requirements
 * - Booking window (how far in advance)
 * - Advance notice requirements
 * - Check-in and check-out day restrictions
 * - Same-day and instant booking settings
 *
 * Blackout dates are configured per site (sites.availability_rules), not here.
 *
 * @module components/dashboard/settings/booking-rules-settings
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { format } from 'date-fns'
import { Loader2, Info, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  bookingRulesSettingsFormSchema,
  type BookingRulesSettingsFormInput,
} from '@/lib/config/schemas'
import type { BookingRulesConfig, DayOfWeek, HolidayRule } from '@/lib/config/types'
import { AddHolidayDialog } from '@/components/dashboard/settings/booking-rules-dialog/add-holiday-dialog'

interface BookingRulesSettingsProps {
  initialConfig?: BookingRulesConfig
  propertyId: string
  openPeriodFrom?: string | null
  openPeriodUntil?: string | null
  onSave?: (config: BookingRulesConfig) => Promise<void>
  canEdit?: boolean
}

/** Local calendar date from YYYY-MM-DD (avoids UTC shift from parseISO). */
function formatHolidayYmd(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), 'MMM d, yyyy')
}

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
]

const defaultFormValues: BookingRulesSettingsFormInput = {
  min_stay_nights: 1,
  max_stay_nights: null,
  booking_window_days: 365,
  advance_notice_days: 0,
  allowed_checkin_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  allowed_checkout_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  same_day_booking_enabled: true,
  instant_booking_enabled: true,
  holiday_rules: [],
  checkout_hold_minutes: 1,
}

const SEASON_ERROR_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function BookingRulesSettings({
  initialConfig,
  propertyId,
  openPeriodFrom,
  openPeriodUntil,
  onSave,
  canEdit = true,
}: BookingRulesSettingsProps) {
  const readOnly = !canEdit
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isAddHolidayDialogOpen, setIsAddHolidayDialogOpen] = useState(false)
  /** When set, dialog opens in edit mode with this rule as `initialValues`. */
  const [holidayBeingEdited, setHolidayBeingEdited] = useState<HolidayRule | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isDirty },
  } = useForm<BookingRulesSettingsFormInput>({
    resolver: zodResolver(bookingRulesSettingsFormSchema),
    defaultValues: initialConfig
      ? (() => {
          const { blackout_dates: _drop, ...rest } = initialConfig
          return { ...defaultFormValues, ...rest }
        })()
      : defaultFormValues,
  })

  const allowedCheckinDays = watch('allowed_checkin_days')
  const allowedCheckoutDays = watch('allowed_checkout_days')
  const sameDayBookingEnabled = watch('same_day_booking_enabled')
  const instantBookingEnabled = watch('instant_booking_enabled')
  const holidayRules = watch('holiday_rules')

  const toggleCheckinDay = (day: DayOfWeek) => {
    const current = allowedCheckinDays
    const updated = current.includes(day)
      ? current.filter((d: DayOfWeek) => d !== day)
      : [...current, day]
    setValue('allowed_checkin_days', updated, { shouldDirty: true })
  }

  const toggleCheckoutDay = (day: DayOfWeek) => {
    const current = allowedCheckoutDays
    const updated = current.includes(day)
      ? current.filter((d: DayOfWeek) => d !== day)
      : [...current, day]
    setValue('allowed_checkout_days', updated, { shouldDirty: true })
  }

  const removeHolidayRule = (id: string) => {
    const next = (holidayRules ?? []).filter((h: HolidayRule) => h.id !== id)
    setValue('holiday_rules', next, { shouldDirty: true, shouldValidate: true })
  }

  const setHolidayRuleEnabled = (id: string, enabled: boolean) => {
    const next = (holidayRules ?? []).map((h: HolidayRule) =>
      h.id === id ? { ...h, enabled } : h,
    )
    setValue('holiday_rules', next, { shouldDirty: true, shouldValidate: true })
  }

  const openAddHolidayDialog = () => {
    setHolidayBeingEdited(null)
    setIsAddHolidayDialogOpen(true)
  }

  const openEditHolidayDialog = (rule: HolidayRule) => {
    setHolidayBeingEdited(rule)
    setIsAddHolidayDialogOpen(true)
  }

  const handleHolidayDialogOpenChange = (open: boolean) => {
    setIsAddHolidayDialogOpen(open)
    if (!open) setHolidayBeingEdited(null)
  }

  const onSubmit = async (data: BookingRulesSettingsFormInput) => {
    setIsSaving(true)

    try {
      const bookingRulesConfig: BookingRulesConfig = {
        ...data,
        blackout_dates: [],
        max_stay_nights: data.max_stay_nights === undefined ? null : data.max_stay_nights,
      }

      if (onSave) {
        await onSave(bookingRulesConfig)
      } else {
        const response = await fetch(`/api/properties/${propertyId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_rules_config: bookingRulesConfig }),
        })

        if (!response.ok) {
          throw new Error('Failed to save booking rules configuration')
        }
      }

      toast({
        title: 'Booking rules saved',
        description: 'Booking rules saved successfully.',
        variant: "success",
      })

      router.refresh()
    } catch (error) {
      console.error('Error saving booking rules:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save booking rules',
        variant: 'destructive',
        className: SEASON_ERROR_TOAST_CLASS,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const { UnsavedChangesDialog } = useUnsavedChangesGuard(isDirty, {
    onSave: async () => {
      const valid = await trigger()
      if (!valid) throw new Error('Validation failed')
      await handleSubmit(onSubmit)()
    },
    message: 'You have unsaved changes to booking rules.',
  })

  return (
    <>
      <form
        onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit(onSubmit)}
        className="space-y-6"
      >
      {/* Stay Duration Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Stay Duration</CardTitle>
          <CardDescription>Set minimum and maximum stay requirements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="min_stay_nights">Minimum Stay (nights)</Label>
              <Input
                id="min_stay_nights"
                type="number"
                min="1"
                max="365"
                placeholder="1"
                disabled={readOnly}
                {...register('min_stay_nights', { valueAsNumber: true })}
              />
              {errors.min_stay_nights?.message != null && (
                <p className="text-sm text-destructive">{String(errors.min_stay_nights.message)}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Guests must book at least this many nights
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_stay_nights">Maximum Stay (nights)</Label>
              <Input
                id="max_stay_nights"
                type="number"
                min="1"
                max="365"
                placeholder="Optional - leave blank for no limit"
                disabled={readOnly}
                {...register('max_stay_nights', {
                  setValueAs: v => v === '' || v === null ? null : parseInt(v),
                })}
              />
              {errors.max_stay_nights?.message != null && (
                <p className="text-sm text-destructive">{String(errors.max_stay_nights.message)}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Maximum nights allowed per reservation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cart Expiration</CardTitle>
          <CardDescription>Set the reservation hold time during checkout</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="checkout_hold_minutes">Hold Timer (minutes)</Label>
          <Input
            id="checkout_hold_minutes"
            type="number"
            min={1}
            max={10080}
            step={1}
            placeholder="5"
            disabled={readOnly}
            {...register('checkout_hold_minutes', { valueAsNumber: true })}
          />
          {errors.checkout_hold_minutes?.message != null && (
            <p className="text-sm text-destructive">{String(errors.checkout_hold_minutes.message)}</p>
          )}
          <p className="text-sm text-muted-foreground">
            How long a pending reservation is held before it expires.
          </p>
        </CardContent>
      </Card>

      {/* Booking Timing Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Timing</CardTitle>
          <CardDescription>Control when bookings can be made</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="booking_window_days">Booking Window (days)</Label>
              <Input
                id="booking_window_days"
                type="number"
                min="1"
                max="730"
                placeholder="365"
                disabled={readOnly}
                {...register('booking_window_days', { valueAsNumber: true })}
              />
              {errors.booking_window_days?.message != null && (
                <p className="text-sm text-destructive">{String(errors.booking_window_days.message)}</p>
              )}
              <p className="text-sm text-muted-foreground">
                How many days in advance guests can book
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="advance_notice_days">Advance Notice (days)</Label>
              <Input
                id="advance_notice_days"
                type="number"
                min="0"
                max="90"
                placeholder="0"
                disabled={readOnly}
                {...register('advance_notice_days', { valueAsNumber: true })}
              />
              {errors.advance_notice_days?.message != null && (
                <p className="text-sm text-destructive">{String(errors.advance_notice_days.message)}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Minimum days before check-in to book (0 = same day)
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Same-Day Booking</Label>
              <p className="text-sm text-muted-foreground">
                Allow guests to book for today&apos;s check-in
              </p>
            </div>
            <Switch
              checked={sameDayBookingEnabled}
              disabled={readOnly}
              onCheckedChange={(checked) => setValue('same_day_booking_enabled', checked, { shouldDirty: true })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Instant Booking</Label>
              <p className="text-sm text-muted-foreground">
                Allow instant booking without manual approval
              </p>
            </div>
            <Switch
              checked={instantBookingEnabled}
              disabled={readOnly}
              onCheckedChange={(checked) => setValue('instant_booking_enabled', checked, { shouldDirty: true })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Check-in Day Restrictions */}
      <Card>
        <CardHeader>
          <CardTitle>Check-In Days</CardTitle>
          <CardDescription>Select which days of the week guests can check in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`checkin-${day.value}`}
                  checked={allowedCheckinDays.includes(day.value)}
                  disabled={readOnly}
                  onCheckedChange={() => toggleCheckinDay(day.value)}
                />
                <Label htmlFor={`checkin-${day.value}`} className="cursor-pointer">
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
          {errors.allowed_checkin_days?.message != null && (
            <p className="text-sm text-destructive">{String(errors.allowed_checkin_days.message)}</p>
          )}
          {allowedCheckinDays.length < 7 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Check-in restricted to:{' '}
                {allowedCheckinDays.map((d: DayOfWeek) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Check-out Day Restrictions */}
      <Card>
        <CardHeader>
          <CardTitle>Check-Out Days</CardTitle>
          <CardDescription>Select which days of the week guests can check out</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`checkout-${day.value}`}
                  checked={allowedCheckoutDays.includes(day.value)}
                  disabled={readOnly}
                  onCheckedChange={() => toggleCheckoutDay(day.value)}
                />
                <Label htmlFor={`checkout-${day.value}`} className="cursor-pointer">
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
          {errors.allowed_checkout_days?.message != null && (
            <p className="text-sm text-destructive">{String(errors.allowed_checkout_days.message)}</p>
          )}
          {allowedCheckoutDays.length < 7 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Check-out restricted to:{' '}
                {allowedCheckoutDays.map((d: DayOfWeek) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle>Holiday Reservation Configuration</CardTitle>
              <CardDescription>Configure how holiday reservations are handled</CardDescription>
            </div>
            {canEdit && (
            <Button type="button" size="sm" onClick={openAddHolidayDialog}>
              <Plus className="h-4 w-4" />
              Add Holiday
            </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {holidayRules == null || holidayRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No holidays yet. Add one above — it will be saved when you click Save Booking Rules.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {holidayRules.map((rule: HolidayRule) => (
                <li
                  key={rule.id}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{rule.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatHolidayYmd(rule.start_date)} – {formatHolidayYmd(rule.end_date)}
                      {' · '}
                      Min {rule.min_stay_nights} night{rule.min_stay_nights !== 1 ? 's' : ''}
                      {rule.max_stay_nights != null
                        ? ` · Max ${rule.max_stay_nights} night${rule.max_stay_nights !== 1 ? 's' : ''}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`holiday-enabled-${rule.id}`} className="sr-only">
                        Enable {rule.title}
                      </Label>
                      <Switch
                        id={`holiday-enabled-${rule.id}`}
                        checked={rule.enabled}
                        disabled={readOnly}
                        onCheckedChange={(checked) => setHolidayRuleEnabled(rule.id, checked)}
                      />
                    </div>
                    {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditHolidayDialog(rule)}
                      aria-label={`Edit ${rule.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    )}
                    {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeHolidayRule(rule.id)}
                      aria-label={`Remove ${rule.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Save Button and Messages */}
      {canEdit && (
      <div className="flex items-center justify-between">
        <Button type="submit" disabled={isSaving || !isDirty}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Booking Rules'}
        </Button>
      </div>
      )}
      </form>

      {canEdit && (
      <AddHolidayDialog
        open={isAddHolidayDialogOpen}
        onOpenChange={handleHolidayDialogOpenChange}
        openPeriodFrom={openPeriodFrom ?? null}
        openPeriodUntil={openPeriodUntil ?? null}
        initialValues={holidayBeingEdited}
        title={holidayBeingEdited ? 'Edit holiday' : 'Add holiday'}
        submitLabel={holidayBeingEdited ? 'Save changes' : 'Add holiday'}
        onSubmit={(holiday) => {
          const list = holidayRules ?? []
          const next = holidayBeingEdited
            ? list.map((h: HolidayRule) => (h.id === holiday.id ? holiday : h))
            : [...list, holiday]
          setValue('holiday_rules', next, { shouldDirty: true, shouldValidate: true })
          setIsAddHolidayDialogOpen(false)
          setHolidayBeingEdited(null)
        }}
      />
      )}
      <UnsavedChangesDialog />
    </>
  )
}

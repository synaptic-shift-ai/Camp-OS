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
import { Loader2, Info } from 'lucide-react'
import {
  bookingRulesSettingsFormSchema,
  type BookingRulesSettingsFormInput,
} from '@/lib/config/schemas'
import type { BookingRulesConfig, DayOfWeek } from '@/lib/config/types'

interface BookingRulesSettingsProps {
  initialConfig?: BookingRulesConfig
  propertyId: string
  onSave?: (config: BookingRulesConfig) => Promise<void>
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
}

export function BookingRulesSettings({ initialConfig, propertyId, onSave }: BookingRulesSettingsProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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

  const onSubmit = async (data: BookingRulesSettingsFormInput) => {
    setIsSaving(true)
    setSaveMessage(null)

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

      setSaveMessage({ type: 'success', text: 'Booking rules saved successfully!' })

      router.refresh()
    } catch (error) {
      console.error('Error saving booking rules:', error)
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save booking rules',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

      {/* Save Button and Messages */}
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          {saveMessage && (
            <Alert variant={saveMessage.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{saveMessage.text}</AlertDescription>
            </Alert>
          )}
        </div>
        <Button type="submit" disabled={isSaving || !isDirty}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Booking Rules'}
        </Button>
      </div>
    </form>
  )
}

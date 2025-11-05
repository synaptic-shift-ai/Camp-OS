'use client'

/**
 * Booking Rules Configuration Settings Component
 *
 * Allows property owners to configure:
 * - Minimum and maximum stay requirements
 * - Booking window (how far in advance)
 * - Advance notice requirements
 * - Check-in and check-out day restrictions
 * - Blackout dates
 * - Same-day and instant booking settings
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
import { Badge } from '@/components/ui/badge'
import { Loader2, Info, X } from 'lucide-react'
import { bookingRulesConfigSchema, type BookingRulesConfigInput } from '@/lib/config/schemas'
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

export function BookingRulesSettings({ initialConfig, propertyId, onSave }: BookingRulesSettingsProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [newBlackoutDate, setNewBlackoutDate] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<BookingRulesConfigInput>({
    resolver: zodResolver(bookingRulesConfigSchema),
    defaultValues: initialConfig || {
      min_stay_nights: 1,
      max_stay_nights: null,
      booking_window_days: 365,
      advance_notice_days: 0,
      allowed_checkin_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      allowed_checkout_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      blackout_dates: [],
      same_day_booking_enabled: true,
      instant_booking_enabled: true,
    },
  })

  const allowedCheckinDays = watch('allowed_checkin_days')
  const allowedCheckoutDays = watch('allowed_checkout_days')
  const blackoutDates = watch('blackout_dates')
  const sameDayBookingEnabled = watch('same_day_booking_enabled')
  const instantBookingEnabled = watch('instant_booking_enabled')

  const toggleCheckinDay = (day: DayOfWeek) => {
    const current = allowedCheckinDays
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day]
    setValue('allowed_checkin_days', updated, { shouldDirty: true })
  }

  const toggleCheckoutDay = (day: DayOfWeek) => {
    const current = allowedCheckoutDays
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day]
    setValue('allowed_checkout_days', updated, { shouldDirty: true })
  }

  const addBlackoutDate = () => {
    if (newBlackoutDate && !blackoutDates.includes(newBlackoutDate)) {
      setValue('blackout_dates', [...blackoutDates, newBlackoutDate], { shouldDirty: true })
      setNewBlackoutDate('')
    }
  }

  const removeBlackoutDate = (date: string) => {
    setValue('blackout_dates', blackoutDates.filter(d => d !== date), { shouldDirty: true })
  }

  const onSubmit = async (data: BookingRulesConfigInput) => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      // Convert undefined to null for max_stay_nights
      const bookingRulesConfig: BookingRulesConfig = {
        ...data,
        max_stay_nights: data.max_stay_nights === undefined ? null : data.max_stay_nights,
      }

      if (onSave) {
        await onSave(bookingRulesConfig)
      } else {
        // Default API call
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

      // Refresh the page data to show updated values
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
              {errors.min_stay_nights && (
                <p className="text-sm text-destructive">{errors.min_stay_nights.message}</p>
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
              {errors.max_stay_nights && (
                <p className="text-sm text-destructive">{errors.max_stay_nights.message}</p>
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
              {errors.booking_window_days && (
                <p className="text-sm text-destructive">{errors.booking_window_days.message}</p>
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
              {errors.advance_notice_days && (
                <p className="text-sm text-destructive">{errors.advance_notice_days.message}</p>
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
                Allow guests to book for today's check-in
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
          {errors.allowed_checkin_days && (
            <p className="text-sm text-destructive">{errors.allowed_checkin_days.message}</p>
          )}
          {allowedCheckinDays.length < 7 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Check-in restricted to: {allowedCheckinDays.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
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
          {errors.allowed_checkout_days && (
            <p className="text-sm text-destructive">{errors.allowed_checkout_days.message}</p>
          )}
          {allowedCheckoutDays.length < 7 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Check-out restricted to: {allowedCheckoutDays.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Blackout Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Blackout Dates</CardTitle>
          <CardDescription>Dates when check-in is not allowed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="date"
              value={newBlackoutDate}
              onChange={(e) => setNewBlackoutDate(e.target.value)}
              placeholder="Select date"
            />
            <Button type="button" onClick={addBlackoutDate} variant="outline">
              Add Date
            </Button>
          </div>

          {blackoutDates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blackoutDates.map((date) => (
                <Badge key={date} variant="secondary" className="pl-3 pr-1">
                  {date}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-auto p-1"
                    onClick={() => removeBlackoutDate(date)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          {blackoutDates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No blackout dates configured
            </p>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Blackout dates prevent check-in on specific dates (e.g., holidays). Guests can still be checked-in if their reservation started before the blackout date.
            </AlertDescription>
          </Alert>
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

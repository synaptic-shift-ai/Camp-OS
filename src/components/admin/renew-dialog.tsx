'use client'

/**
 * Renew Reservation Dialog
 *
 * Allows operators to create a renewal reservation for the next season/month.
 * Features real-time availability checking and deposit/payment scheduling.
 * Used for seasonal and long-term rental renewals.
 */

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRouter } from 'next/navigation'
import { useActionAvailability } from '@/lib/hooks/use-action-availability'
import { AvailabilityFeedback } from './availability-feedback'

interface RenewDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  currentCheckOut: string
  bookingType: 'seasonal' | 'monthly' | 'weekly' | 'nightly' | 'long_term'
  siteNumber: string
  siteName?: string | undefined
  pricePerNight: number
  trigger?: React.ReactNode
}

/**
 * Calculate nights between two dates
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  const diffTime = end.getTime() - start.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Format money from cents
 */
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/**
 * Add months to a date
 */
function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setMonth(date.getMonth() + months)
  return date.toISOString().split('T')[0]!
}

/**
 * Calculate default next period based on booking type
 */
function calculateDefaultNextPeriod(currentCheckOut: string, bookingType: string) {
  const checkOutDate = new Date(currentCheckOut + 'T00:00:00')
  const nextDay = new Date(checkOutDate)
  nextDay.setDate(checkOutDate.getDate() + 1)

  const startDate = nextDay.toISOString().split('T')[0]!

  // Default period lengths
  if (bookingType === 'seasonal') {
    // Next season (6 months)
    return {
      startDate,
      endDate: addMonths(startDate, 6),
      season: 'Next Season',
    }
  } else if (bookingType === 'monthly') {
    // Next month
    return {
      startDate,
      endDate: addMonths(startDate, 1),
      season: 'Next Month',
    }
  } else if (bookingType === 'weekly') {
    // Next week
    const end = new Date(startDate + 'T00:00:00')
    end.setDate(end.getDate() + 7)
    return {
      startDate,
      endDate: end.toISOString().split('T')[0]!,
      season: 'Next Week',
    }
  }

  // Default to 1 month
  return {
    startDate,
    endDate: addMonths(startDate, 1),
    season: 'Next Period',
  }
}

export function RenewDialog({
  reservationId,
  confirmationNumber,
  guestName,
  currentCheckOut,
  bookingType,
  siteNumber,
  siteName,
  pricePerNight,
  trigger,
}: RenewDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Calculate default period
  const defaultPeriod = useMemo(
    () => calculateDefaultNextPeriod(currentCheckOut, bookingType),
    [currentCheckOut, bookingType]
  )

  // Form state
  const [nextPeriodStart, setNextPeriodStart] = useState(defaultPeriod.startDate)
  const [nextPeriodEnd, setNextPeriodEnd] = useState(defaultPeriod.endDate)
  const [seasonName, setSeasonName] = useState(defaultPeriod.season)
  const [renewalDeadline, setRenewalDeadline] = useState('')
  const [depositPercent, setDepositPercent] = useState('30')
  const [notes, setNotes] = useState('')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const defaultPeriod = calculateDefaultNextPeriod(currentCheckOut, bookingType)
      setNextPeriodStart(defaultPeriod.startDate)
      setNextPeriodEnd(defaultPeriod.endDate)
      setSeasonName(defaultPeriod.season)

      // Default deadline: 30 days from today
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + 30)
      setRenewalDeadline(deadline.toISOString().split('T')[0]!)

      setDepositPercent('30')
      setNotes('')
      setError(null)
    }
  }, [open, currentCheckOut, bookingType])

  // Calculate pricing
  const pricingDetails = useMemo(() => {
    const nights = calculateNights(nextPeriodStart, nextPeriodEnd)
    const totalAmount = nights * pricePerNight
    const depositAmount = Math.round(totalAmount * (parseInt(depositPercent) / 100))
    const balanceAmount = totalAmount - depositAmount

    return {
      nights,
      totalAmount,
      depositAmount,
      balanceAmount,
    }
  }, [nextPeriodStart, nextPeriodEnd, pricePerNight, depositPercent])

  // Real-time availability checking
  const { checking, result, error: availError } = useActionAvailability(
    reservationId,
    'renew',
    {
      nextPeriodStart,
      nextPeriodEnd,
    }
  )

  // Determine if we can submit
  const canSubmit =
    nextPeriodStart &&
    nextPeriodEnd &&
    renewalDeadline &&
    !loading &&
    !checking &&
    result?.available &&
    result.status === 'fully_available'

  const handleRenew = async () => {
    if (!canSubmit) return

    try {
      setLoading(true)
      setError(null)

      // Validate dates
      const startDate = new Date(nextPeriodStart + 'T00:00:00')
      const endDate = new Date(nextPeriodEnd + 'T00:00:00')
      const deadline = new Date(renewalDeadline + 'T00:00:00')

      if (endDate <= startDate) {
        throw new Error('End date must be after start date')
      }

      if (startDate <= new Date(currentCheckOut + 'T00:00:00')) {
        throw new Error('Next period must start after current checkout date')
      }

      if (deadline >= startDate) {
        throw new Error('Renewal deadline must be before the next period starts')
      }

      const response = await fetch(`/api/v1/reservations/${reservationId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'renew',
          params: {
            nextPeriod: {
              start_date: nextPeriodStart,
              end_date: nextPeriodEnd,
              season: seasonName,
            },
            renewalDeadline,
            depositAmount: pricingDetails.depositAmount,
            notes: notes.trim() || undefined,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process renewal')
      }

      // Success - close dialog and refresh the page
      setOpen(false)
      router.refresh()
    } catch (err) {
      console.error('[RenewDialog] Error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Renew
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-[650px]">
        <SheetHeader>
          <SheetTitle>Renew Reservation</SheetTitle>
          <SheetDescription>
            Create a renewal reservation for the next {bookingType} period for {guestName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Reservation Info */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
            <div className="text-sm">
              <span className="font-medium">Confirmation:</span>{' '}
              <span className="text-muted-foreground">{confirmationNumber}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Guest:</span>{' '}
              <span className="text-muted-foreground capitalize">{guestName}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Site:</span>{' '}
              <span className="text-muted-foreground">
                #{siteNumber}
                {siteName && <span className="ml-1">({siteName})</span>}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Current Check-out:</span>{' '}
              <span className="text-muted-foreground">
                {new Date(currentCheckOut + 'T00:00:00').toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Season/Period Name */}
          <div className="space-y-2">
            <Label htmlFor="seasonName">Period Name *</Label>
            <Input
              id="seasonName"
              type="text"
              placeholder="e.g., Summer 2025, Next Month, etc."
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Next Period Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nextPeriodStart">Start Date *</Label>
              <Input
                id="nextPeriodStart"
                type="date"
                value={nextPeriodStart}
                onChange={(e) => setNextPeriodStart(e.target.value)}
                disabled={loading}
                required
                min={currentCheckOut}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextPeriodEnd">End Date *</Label>
              <Input
                id="nextPeriodEnd"
                type="date"
                value={nextPeriodEnd}
                onChange={(e) => setNextPeriodEnd(e.target.value)}
                disabled={loading}
                required
                min={nextPeriodStart}
              />
            </div>
          </div>

          {/* Renewal Deadline */}
          <div className="space-y-2">
            <Label htmlFor="renewalDeadline">
              Renewal Deadline *
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                (deposit due by)
              </span>
            </Label>
            <Input
              id="renewalDeadline"
              type="date"
              value={renewalDeadline}
              onChange={(e) => setRenewalDeadline(e.target.value)}
              disabled={loading}
              required
              max={nextPeriodStart}
            />
          </div>

          {/* Deposit Percentage */}
          <div className="space-y-2">
            <Label htmlFor="depositPercent">Deposit Percentage *</Label>
            <Select value={depositPercent} onValueChange={setDepositPercent} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select deposit %" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10% - Light commitment</SelectItem>
                <SelectItem value="25">25% - Standard</SelectItem>
                <SelectItem value="30">30% - Recommended</SelectItem>
                <SelectItem value="50">50% - Secure booking</SelectItem>
                <SelectItem value="100">100% - Full payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pricing Breakdown */}
          <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-3 space-y-2">
            <div className="text-sm font-medium text-blue-700">Payment Schedule</div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period:</span>
                <span>
                  {pricingDetails.nights} nights @ {formatMoney(pricePerNight)}/night
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-medium">{formatMoney(pricingDetails.totalAmount)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">
                  Deposit ({depositPercent}%) - Due by {renewalDeadline}:
                </span>
                <span className="font-medium text-orange-600">
                  {formatMoney(pricingDetails.depositAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Balance - Due on {nextPeriodStart}:
                </span>
                <span className="font-medium text-green-600">
                  {formatMoney(pricingDetails.balanceAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Availability Feedback */}
          {checking && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Checking availability for next period...</AlertDescription>
            </Alert>
          )}

          {!checking && result && <AvailabilityFeedback result={result} />}

          {availError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{availError}</AlertDescription>
            </Alert>
          )}

          {/* Warning if not fully available */}
          {result && result.status !== 'fully_available' && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700">
                Renewal can only proceed if the site is fully available. Consider adjusting dates
                or offering an alternative site.
              </AlertDescription>
            </Alert>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., Loyal guest from previous seasons, Special arrangements, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleRenew} disabled={!canSubmit}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Processing...' : 'Create Renewal'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

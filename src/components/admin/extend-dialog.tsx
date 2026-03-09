'use client'

/**
 * Extend Reservation Dialog
 *
 * Allows operators to extend a reservation's check-in/out dates.
 * Features real-time availability checking with visual feedback.
 * Shows pricing changes and conflicts before submission.
 */

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AlertCircle, Loader2, Calendar } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRouter } from 'next/navigation'
import { useActionAvailability } from '@/lib/hooks/use-action-availability'
import { AvailabilityFeedback } from './availability-feedback'
import { calculateBaseSubtotalCents } from '@/lib/booking/pricing'

interface ExtendDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  currentCheckIn: string
  currentCheckOut: string
  siteNumber: string
  siteName?: string | undefined
  pricePerNight: number
  totalAmount: number
  weeklyRateCents: number | null
  monthlyRateCents: number | null
  status: string
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
 * Format nights as "X week ($Y) + Z night(s) ($W/night)" or "X nights @ $Y/night" for display
 */
function formatNightsBreakdown(
  nights: number,
  basePriceCents: number,
  weeklyRateCents: number | null,
  monthlyRateCents: number | null
): string {
  if (nights >= 28 && monthlyRateCents != null) {
    const fullMonths = Math.floor(nights / 28)
    const remainder = nights % 28
    const monthLabel = fullMonths === 1 ? '1 month' : `${fullMonths} months`
    if (remainder === 0) {
      return `${monthLabel} (${formatMoney(monthlyRateCents)})`
    }
    const nightLabel = remainder === 1 ? '1 night' : `${remainder} nights`
    return `${monthLabel} (${formatMoney(monthlyRateCents)}) + ${nightLabel} (${formatMoney(basePriceCents)}/night)`
  }
  if (nights >= 7) {
    const weeklyCents = weeklyRateCents ?? basePriceCents * 7
    const fullWeeks = Math.floor(nights / 7)
    const remainder = nights % 7
    const weekLabel = fullWeeks === 1 ? '1 week' : `${fullWeeks} weeks`
    if (remainder === 0) {
      return `${weekLabel} (${formatMoney(weeklyCents)})`
    }
    const nightLabel = remainder === 1 ? '1 night' : `${remainder} nights`
    return `${weekLabel} (${formatMoney(weeklyCents)}) + ${nightLabel} (${formatMoney(basePriceCents)}/night)`
  }
  return `${nights} night${nights !== 1 ? 's' : ''} @ ${formatMoney(basePriceCents)}/night`
}

/**
 * Format for Pricing Impact: "N nights @ 1 week ($200.00) + 1 night ($30/night)" or "7 nights @ 1 week ($200.00)"
 */
function formatNightsWithBreakdown(
  nights: number,
  basePriceCents: number,
  weeklyRateCents: number | null,
  monthlyRateCents: number | null
): string {
  const breakdown = formatNightsBreakdown(nights, basePriceCents, weeklyRateCents, monthlyRateCents)
  if (nights >= 7) {
    return `${nights} nights @ ${breakdown}`
  }
  return breakdown
}

export function ExtendDialog({
  reservationId,
  confirmationNumber,
  guestName,
  currentCheckIn,
  currentCheckOut,
  siteNumber,
  siteName,
  pricePerNight,
  totalAmount,
  weeklyRateCents,
  monthlyRateCents,
  status,
  trigger,
}: ExtendDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [projectedTotalCents, setProjectedTotalCents] = useState<number | null>(null)
  const router = useRouter()

  // Form state
  const [newCheckIn, setNewCheckIn] = useState(currentCheckIn)
  const [newCheckOut, setNewCheckOut] = useState(currentCheckOut)
  const [notes, setNotes] = useState('')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNewCheckIn(currentCheckIn)
      setNewCheckOut(currentCheckOut)
      setNotes('')
      setError(null)
      setProjectedTotalCents(null)
    }
  }, [open, currentCheckIn, currentCheckOut])

  // Check if dates have changed
  const hasChanges = newCheckIn !== currentCheckIn || newCheckOut !== currentCheckOut

  // Base-only pricing impact (fallback when full preview not available)
  const pricingImpact = useMemo(() => {
    if (!hasChanges) return null
    const originalNights = calculateNights(currentCheckIn, currentCheckOut)
    const newNights = calculateNights(newCheckIn, newCheckOut)
    const newTotalCents = calculateBaseSubtotalCents(
      newNights,
      pricePerNight,
      weeklyRateCents,
      monthlyRateCents
    )
    const priceChange = newTotalCents - totalAmount
    return {
      originalNights,
      newNights,
      nightsAdded: newNights - originalNights,
      priceChange,
      newTotalCents,
    }
  }, [hasChanges, currentCheckIn, currentCheckOut, newCheckIn, newCheckOut, pricePerNight, totalAmount, weeklyRateCents, monthlyRateCents])

  // Fetch full projected total (discounts + fees) when dates change
  useEffect(() => {
    if (!hasChanges || !newCheckIn || !newCheckOut || newCheckOut <= newCheckIn) {
      setProjectedTotalCents(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setProjectedTotalCents(null)
    fetch(`/api/v1/reservations/${reservationId}/extend-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newCheckIn, newCheckOut }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data?.success && typeof data?.data?.projectedTotalCents === 'number') {
          setProjectedTotalCents(data.data.projectedTotalCents)
        }
      })
      .catch(() => {
        if (!cancelled) setProjectedTotalCents(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reservationId, hasChanges, newCheckIn, newCheckOut])

  // Use full projected total when available, else base-only
  const displayNewTotalCents = projectedTotalCents ?? pricingImpact?.newTotalCents ?? 0
  const displayPriceChange = displayNewTotalCents - totalAmount

  // Real-time availability checking
  const { checking, result, error: availError } = useActionAvailability(
    reservationId,
    'extend',
    {
      newCheckIn: newCheckIn !== currentCheckIn ? newCheckIn : undefined,
      newCheckOut: newCheckOut !== currentCheckOut ? newCheckOut : undefined,
    }
  )

  // Determine if we can submit
  const canSubmit =
    hasChanges &&
    !loading &&
    !checking &&
    result?.available &&
    (result.status === 'fully_available' || result.status === 'partially_available')

  const handleExtend = async () => {
    if (!canSubmit) return

    try {
      setLoading(true)
      setError(null)

      // Validate dates
      const checkInDate = new Date(newCheckIn + 'T00:00:00')
      const checkOutDate = new Date(newCheckOut + 'T00:00:00')

      if (checkOutDate <= checkInDate) {
        throw new Error('Check-out date must be after check-in date')
      }

      // Ensure at least one date has changed
      if (newCheckIn === currentCheckIn && newCheckOut === currentCheckOut) {
        throw new Error('Please change at least one date to extend the reservation')
      }

      const response = await fetch(`/api/v1/reservations/${reservationId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'extend',
          params: {
            newCheckIn: newCheckIn !== currentCheckIn ? newCheckIn : undefined,
            newCheckOut: newCheckOut !== currentCheckOut ? newCheckOut : undefined,
            notes: notes.trim() || undefined,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to extend reservation')
      }

      // Success - close dialog and refresh the page
      setOpen(false)
      router.refresh()
    } catch (err) {
      console.error('[ExtendDialog] Error:', err)
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
            <Calendar className="mr-2 h-4 w-4" />
            Extend Stay
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>Extend Reservation</SheetTitle>
          <SheetDescription>
            Add nights before or after the current reservation for {guestName}
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
              <span className="text-muted-foreground">{guestName}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Site:</span>{' '}
              <span className="text-muted-foreground">
                #{siteNumber}
                {siteName && <span className="ml-1">({siteName})</span>}
              </span>
            </div>
          </div>

          {/* Current Dates */}
          <div className="rounded-lg border border-dashed p-3 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground uppercase">
              Current Dates
            </div>
            <div className="text-sm">
              <span className="font-medium">Check-in:</span>{' '}
              <span>{new Date(currentCheckIn + 'T00:00:00').toLocaleDateString()}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Check-out:</span>{' '}
              <span>{new Date(currentCheckOut + 'T00:00:00').toLocaleDateString()}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {calculateNights(currentCheckIn, currentCheckOut)} nights
            </div>
          </div>

          {/* New Check-in Date */}
          {status === 'confirmed' && (
            <div className="space-y-2">
              <Label htmlFor="newCheckIn">
                New Check-in Date
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  (select earlier to extend before)
                </span>
              </Label>
              <Input
                id="newCheckIn"
                type="date"
                value={newCheckIn}
                onChange={(e) => setNewCheckIn(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {/* New Check-out Date */}
          <div className="space-y-2">
            <Label htmlFor="newCheckOut">
              New Check-out Date
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                (select later to extend after)
              </span>
            </Label>
            <Input
              id="newCheckOut"
              type="date"
              value={newCheckOut}
              onChange={(e) => setNewCheckOut(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Pricing Impact - amounts only shown after full pricing loads (or fallback if API fails) */}
          {pricingImpact && (
            <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-3 space-y-2">
              <div className="text-sm font-medium text-blue-700">Pricing Impact</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original:</span>
                  <span>
                    {formatNightsWithBreakdown(
                      pricingImpact.originalNights,
                      pricePerNight,
                      weeklyRateCents,
                      monthlyRateCents
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New:</span>
                  <span>
                    {formatNightsWithBreakdown(
                      pricingImpact.newNights,
                      pricePerNight,
                      weeklyRateCents,
                      monthlyRateCents
                    )}
                  </span>
                </div>
                {previewLoading ? (
                  <div className="pt-2 border-t flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Calculating total (discounts and fees)…</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between pt-2 border-t font-medium">
                      <span>
                        {pricingImpact.nightsAdded > 0 ? 'Additional Charge:' : 'Refund:'}
                      </span>
                      <span
                        className={
                          pricingImpact.nightsAdded > 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {pricingImpact.nightsAdded > 0 ? '+' : ''}
                        {formatMoney(displayPriceChange)}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>New total:</span>
                      <span>{formatMoney(displayNewTotalCents)}</span>
                    </div>
                    {projectedTotalCents != null && (
                      <p className="text-xs text-muted-foreground pt-1">
                        Includes applicable discounts and additional charges for this reservation.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Availability Feedback */}
          {hasChanges && checking && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Checking availability...</AlertDescription>
            </Alert>
          )}

          {hasChanges && !checking && result && (
            <AvailabilityFeedback
              result={result}
              {...(!previewLoading && {
                overrideAdditionalChargeCents: displayPriceChange,
              })}
            />
          )}

          {hasChanges && availError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{availError}</AlertDescription>
            </Alert>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., Guest requested early arrival, Weather-related extension, etc."
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
          <Button onClick={handleExtend} disabled={!canSubmit}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Processing...' : 'Extend Reservation'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

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

interface ExtendDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  currentCheckIn: string
  currentCheckOut: string
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

export function ExtendDialog({
  reservationId,
  confirmationNumber,
  guestName,
  currentCheckIn,
  currentCheckOut,
  siteNumber,
  siteName,
  pricePerNight,
  trigger,
}: ExtendDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    }
  }, [open, currentCheckIn, currentCheckOut])

  // Check if dates have changed
  const hasChanges = newCheckIn !== currentCheckIn || newCheckOut !== currentCheckOut

  // Calculate pricing impact
  const pricingImpact = useMemo(() => {
    if (!hasChanges) return null

    const originalNights = calculateNights(currentCheckIn, currentCheckOut)
    const newNights = calculateNights(newCheckIn, newCheckOut)
    const nightsAdded = newNights - originalNights
    const priceChange = nightsAdded * pricePerNight

    return {
      originalNights,
      newNights,
      nightsAdded,
      priceChange,
    }
  }, [hasChanges, currentCheckIn, currentCheckOut, newCheckIn, newCheckOut, pricePerNight])

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

      const response = await fetch(`/api/admin/reservations/${reservationId}/actions`, {
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
        throw new Error(data.error || 'Failed to extend reservation')
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

          {/* Pricing Impact */}
          {pricingImpact && (
            <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-3 space-y-2">
              <div className="text-sm font-medium text-blue-700">Pricing Impact</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original:</span>
                  <span>
                    {pricingImpact.originalNights} nights @ {formatMoney(pricePerNight)}/night
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New:</span>
                  <span>
                    {pricingImpact.newNights} nights @ {formatMoney(pricePerNight)}/night
                  </span>
                </div>
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
                    {formatMoney(pricingImpact.priceChange)}
                  </span>
                </div>
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

          {hasChanges && !checking && result && <AvailabilityFeedback result={result} />}

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

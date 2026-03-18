'use client'

/**
 * Check-in Dialog Component
 *
 * Dialog for performing guest check-in workflow.
 * Displays reservation details, handles balance payment, and calls check-in API.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Loader2, CheckCircle, DollarSign, Calendar, Users, Home, Banknote, CreditCard, FileText } from 'lucide-react'
import type { Reservation } from '@/lib/booking/types'
import { asYyyyMmDd, formatDisplayDate, normalizeDateString } from '@/lib/utils'

interface CheckInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: Reservation & {
    guest?: { first_name: string; last_name: string; email: string }
    site?: { site_number: string; site_name: string | null }
  }
  blackoutDates?: string[] | undefined
}

export function CheckInDialog({
  open,
  onOpenChange,
  reservation,
  blackoutDates,
}: CheckInDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkInNotes, setCheckInNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('')

  const todayStr = asYyyyMmDd(new Date())
  const reservationStartStr = normalizeDateString(reservation.check_in_date)
  const isLateArrival = reservationStartStr < todayStr
  const isBlockedByBlackout =
    (blackoutDates ?? []).includes(todayStr) &&
    reservationStartStr === todayStr &&
    !isLateArrival
  const todayDateLabel = formatDisplayDate(todayStr)

  // Calculate outstanding balance
  const outstandingBalance = Math.max(0, reservation.total_amount - reservation.paid_amount)
  const balanceInDollars = (outstandingBalance / 100).toFixed(2)
  const hasBalance = outstandingBalance > 0

  const handleCheckIn = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      if (isBlockedByBlackout) {
        setError(
          `Check-in is not allowed today ${todayDateLabel} due to blackout date restrictions. Guests may only be checked in today if their reservation started before today.`
        )
        return
      }

      // Determine if payment is being collected
      const isCollectingPayment = hasBalance && paymentMethod && paymentMethod !== 'skip'

      const response = await fetch(`/api/v1/reservations/${reservation.id}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          balancePaidCents: isCollectingPayment ? outstandingBalance : 0,
          notes: checkInNotes.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to check in guest')
      }

      toast({
        title: 'Check-in Successful',
        description: `${reservation.guest?.first_name} ${reservation.guest?.last_name} has been checked in to Site ${reservation.site?.site_number}`,
      })

      onOpenChange(false)
      router.refresh()
    } catch (err) {
      console.error('Check-in error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    setCheckInNotes('')
    setPaymentMethod('')
    setError(null)
    onOpenChange(false)
  }

  // Format dates
  const checkInDate = new Date(reservation.check_in_date).toLocaleDateString()
  const checkOutDate = new Date(reservation.check_out_date).toLocaleDateString()
  const nights = Math.ceil(
    (new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) /
    (1000 * 60 * 60 * 24)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Check In Guest
          </DialogTitle>
          <DialogDescription>
            Confirm guest arrival and complete check-in process
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Guest Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Guest Information
            </h3>
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground">Guest Name</p>
                <p className="font-medium">
                  {reservation.guest?.first_name} {reservation.guest?.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{reservation.guest?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Confirmation #</p>
                <p className="font-mono text-sm font-semibold">{reservation.confirmation_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="secondary">{reservation.status}</Badge>
              </div>
            </div>
          </div>

          {/* Reservation Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Reservation Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Site</p>
                  <p className="font-medium">
                    {reservation.site?.site_name || `Site ${reservation.site?.site_number}`}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Dates</p>
                  <p className="font-medium text-sm">
                    {checkInDate} - {checkOutDate}
                  </p>
                  <p className="text-xs text-muted-foreground">{nights} nights</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Guests</p>
                  <p className="font-medium">
                    {reservation.num_adults} Adults, {reservation.num_children} Children
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-medium">${(reservation.total_amount / 100).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          {hasBalance && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Balance Due
              </h3>
              <Alert>
                <DollarSign className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-semibold">Outstanding Balance: ${balanceInDollars}</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Paid: ${(reservation.paid_amount / 100).toFixed(2)} of $
                    {(reservation.total_amount / 100).toFixed(2)}
                  </p>
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Collect Payment</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        <span>Cash - ${balanceInDollars}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="check">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Check - ${balanceInDollars}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="card">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Card - ${balanceInDollars}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="skip">
                      <span className="text-muted-foreground">Skip - Collect later</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {paymentMethod && paymentMethod !== 'skip' && (
                  <p className="text-xs text-muted-foreground">
                    Recording ${balanceInDollars} payment via {paymentMethod}
                  </p>
                )}
                {paymentMethod === 'skip' && (
                  <p className="text-xs text-amber-600">
                    Guest will check in with outstanding balance
                  </p>
                )}
              </div>
            </div>
          )}

          {!hasBalance && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Reservation is fully paid. No additional payment required.
              </AlertDescription>
            </Alert>
          )}

          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="notes">Check-in Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Record any special requests, observations, or details..."
              value={checkInNotes}
              onChange={(e) => setCheckInNotes(e.target.value)}
              rows={3}
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

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleCheckIn} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Check-in
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

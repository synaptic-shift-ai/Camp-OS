'use client'

/**
 * Check-out Dialog Component
 *
 * Dialog for performing guest check-out workflow.
 * Displays reservation details, handles damage reporting, and calls check-out API.
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Loader2, LogOut, DollarSign, Calendar, Users, Home, AlertTriangle } from 'lucide-react'
import type { Reservation } from '@/lib/booking/types'
import { asYyyyMmDd, dayOfWeekFromYyyyMmDd, formatDisplayDate, normalizeDateString } from '@/lib/utils'

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

type SiteStatusForBadge =
  | 'available'
  | 'reserved'
  | 'booked'
  | 'occupied'
  | 'housekeeping'
  | 'maintenance'
  | 'unavailable'

const SITE_STATUS_BADGE_CLASS: Record<SiteStatusForBadge, string> = {
  available: 'bg-green-500/10 text-green-600 border-green-500/20',
  reserved: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  booked: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  occupied: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  housekeeping: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  maintenance: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  unavailable: 'bg-red-500/10 text-red-600 border-red-500/20',
}

function siteStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

interface CheckOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: Reservation & {
    guest?: { first_name: string; last_name: string; email: string }
    site?: { site_number: string; site_name: string | null; status?: string | null }
  }
  allowedCheckOutDays?: string[] | undefined
  checkOutTime?: string | null | undefined
}

export function CheckOutDialog({
  open,
  onOpenChange,
  reservation,
  allowedCheckOutDays,
  checkOutTime,
}: CheckOutDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkOutNotes, setCheckOutNotes] = useState('')
  const [hasDamages, setHasDamages] = useState(false)
  const [showLateCheckOutWarning, setShowLateCheckOutWarning] = useState(false)

  const todayStr = asYyyyMmDd(new Date())
  const reservationEndStr = normalizeDateString(reservation.check_out_date)
  const todayLabel = formatDisplayDate(todayStr)
  const todayDay = dayOfWeekFromYyyyMmDd(todayStr)
  const isBlockedByCheckOutDay =
    (allowedCheckOutDays ?? []).length > 0 &&
    !(allowedCheckOutDays ?? []).includes(todayDay) &&
    reservationEndStr >= todayStr

  // Calculate outstanding balance
  const outstandingBalance = Math.max(0, reservation.total_amount - reservation.paid_amount)
  const balanceInDollars = (outstandingBalance / 100).toFixed(2)
  const hasBalance = outstandingBalance > 0

  const rawSiteStatus = reservation.site?.status ?? null
  const siteStatusForUi =
    rawSiteStatus && rawSiteStatus in SITE_STATUS_BADGE_CLASS
      ? (rawSiteStatus as SiteStatusForBadge)
      : null

  const parsePropertyTimeForReservationDate = (time?: string | null): Date | null => {
    if (!time) return null
    const [hour = 0, minute = 0] = time.split(':').map(Number)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null

    const reservationDate = new Date(`${reservationEndStr}T00:00:00`)
    if (Number.isNaN(reservationDate.getTime())) return null

    reservationDate.setHours(hour, minute, 0, 0)
    return reservationDate
  }

  const configuredCheckOutDateTime = parsePropertyTimeForReservationDate(checkOutTime)
  const isLateCheckOutAttempt =
    reservationEndStr === todayStr &&
    configuredCheckOutDateTime !== null &&
    new Date() > configuredCheckOutDateTime

  const handleCheckOut = async (forceProceed = false) => {
    setIsProcessing(true)
    setError(null)

    try {
      if (isLateCheckOutAttempt && !forceProceed) {
        setShowLateCheckOutWarning(true)
        return
      }
      
      if (isBlockedByCheckOutDay) {
        setError(
          `Check-out is not allowed today (${todayLabel}) due to check-out day restrictions.`
        )
        return
      }

      const response = await fetch(`/api/v1/reservations/${reservation.id}/check-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hasDamages,
          notes: checkOutNotes.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check out guest')
      }

      toast({
        title: 'Check-out Successful',
        description: `${reservation.guest?.first_name} ${reservation.guest?.last_name} has been checked out from Site ${reservation.site?.site_number}`,
        className: SEASON_ALERT_TOAST_CLASS,
      })

      onOpenChange(false)
      router.refresh()
    } catch (err) {
      console.error('Check-out error:', err)
      toast({
        title: 'Check-out failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    setCheckOutNotes('')
    setHasDamages(false)
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-blue-600" />
              Check Out Guest
            </DialogTitle>
            <DialogDescription>
              Complete the guest departure and site inspection
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
                Stay Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Home className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Site</p>
                      <p className="font-medium mt-0.5">
                        {reservation.site?.site_name || `Site ${reservation.site?.site_number}`}
                      </p>
                    </div>
                    {rawSiteStatus ? (
                      <Badge
                        variant="outline"
                        className={`shrink-0 ${siteStatusForUi
                          ? SITE_STATUS_BADGE_CLASS[siteStatusForUi]
                          : 'text-muted-foreground'
                          }`}
                      >
                        {siteStatusLabel(rawSiteStatus)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Stay</p>
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

            {/* Outstanding Balance Warning */}
            {hasBalance && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-semibold">Outstanding Balance: ${balanceInDollars}</span>
                  <p className="text-sm mt-1">
                    This guest has an unpaid balance. Consider collecting payment before check-out.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Site Inspection */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Site Inspection
              </h3>
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <Checkbox
                  id="damages"
                  checked={hasDamages}
                  onCheckedChange={(checked) => setHasDamages(checked === true)}
                />
                <Label htmlFor="damages" className="cursor-pointer">
                  Report damages to site or property
                </Label>
              </div>
              {hasDamages && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Please describe the damages in the notes below. A maintenance ticket may be created.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <Label htmlFor="notes">Check-out Notes {hasDamages && <span className="text-destructive">*</span>}</Label>
              <Textarea
                id="notes"
                placeholder={hasDamages
                  ? "Describe the damages found during inspection..."
                  : "Record any observations, feedback, or details..."
                }
                value={checkOutNotes}
                onChange={(e) => setCheckOutNotes(e.target.value)}
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
            <Button
              onClick={() => void handleCheckOut()}
              disabled={isProcessing || (hasDamages && !checkOutNotes.trim())}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Complete Check-out
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={showLateCheckOutWarning} onOpenChange={setShowLateCheckOutWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Late check-out warning</AlertDialogTitle>
          <AlertDialogDescription>
            This reservation is being checked out after the configured check-out time
            {checkOutTime ? ` (${checkOutTime})` : ''}. Do you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setShowLateCheckOutWarning(false)
              void handleCheckOut(true)
            }}
          >
            Continue check-out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  )
}

'use client'

/**
 * Check-in Dialog Component
 *
 * Dialog for performing guest check-in workflow.
 * Displays reservation details, handles balance payment, and calls check-in API.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { isAccessDeniedError } from '@/lib/utils/is-access-denied-error'
import { AlertCircle, Loader2, CheckCircle, DollarSign, Calendar, Users, Home, Banknote, CreditCard, FileText, AlertTriangle, Shield } from 'lucide-react'
import {
  AmericanExpressFlatRoundedIcon,
  DiscoverFlatRoundedIcon,
  GenericFlatRoundedIcon,
  MastercardFlatRoundedIcon,
  VisaFlatRoundedIcon,
} from 'react-svg-credit-card-payment-icons'
import type { Reservation } from '@/lib/booking/types'
import { asYyyyMmDd, dayOfWeekFromYyyyMmDd, formatDisplayDate, normalizeDateString } from '@/lib/utils'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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

function PaymentCardLogo({ brand }: { brand: string }) {
  const normalized = brand.trim().toLowerCase()
  switch (normalized) {
    case 'visa':
      return <VisaFlatRoundedIcon width={40} />
    case 'mastercard':
      return <MastercardFlatRoundedIcon width={40} />
    case 'amex':
    case 'american express':
    case 'americanexpress':
      return <AmericanExpressFlatRoundedIcon width={40} />
    case 'discover':
      return <DiscoverFlatRoundedIcon width={40} />
    default:
      return <GenericFlatRoundedIcon width={40} />
  }
}

/**
 * Inner component for Stripe CardElement.
 * Must be rendered inside <Elements> provider.
 */
function IncidentalsCardForm({
  onPaymentMethodId,
  setupIntentSecret,
}: {
  onPaymentMethodId: (pmId: string | null) => void
  setupIntentSecret: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const { resolvedTheme } = useTheme()
  const [cardError, setCardError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const isDarkMode = resolvedTheme === 'dark'

  // Confirm SetupIntent when card details are complete and user hasn't interacted with submit yet.
  // We use a lightweight approach: confirm on blur/change when the element is complete.
  const handleChange = async (event: any) => {
    if (event.error) {
      setCardError(event.error.message)
      onPaymentMethodId(null)
    } else {
      setCardError(null)
    }
  }

  const handleConfirmCard = async () => {
    if (!stripe || !elements) return
    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setCardError('Card form is not ready yet. Please try again.')
      onPaymentMethodId(null)
      return
    }

    setConfirming(true)
    setCardError(null)
    try {
      const { setupIntent, error } = await stripe.confirmCardSetup(setupIntentSecret, {
        payment_method: {
          card: cardElement,
        },
      })

      if (error) {
        setCardError(error.message ?? 'Failed to confirm card')
        onPaymentMethodId(null)
      } else if (setupIntent?.status === 'succeeded' && setupIntent.payment_method) {
        onPaymentMethodId(setupIntent.payment_method as string)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to confirm card details'
      setCardError(message)
      onPaymentMethodId(null)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 dark:border-zinc-500 dark:bg-zinc-950">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: {
                fontSize: '14px',
                color: isDarkMode ? '#f5f5f5' : '#111827',
                '::placeholder': {
                  color: isDarkMode ? '#9ca3af' : '#6b7280',
                },
              },
              invalid: {
                color: '#ef4444',
              },
            },
          }}
          onChange={handleChange}
        />
      </div>
      {cardError && (
        <p className="text-xs text-destructive">{cardError}</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handleConfirmCard()}
        disabled={!stripe || confirming}
        className="gap-2"
      >
        {confirming ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Confirming…
          </>
        ) : (
          <>
            <CheckCircle className="h-3.5 w-3.5" />
            Save Card
          </>
        )}
      </Button>
    </div>
  )
}

interface CheckInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: Reservation & {
    guest?: { first_name: string; last_name: string; email: string }
    site?: { site_number: string; site_name: string | null; status?: string | null }
    payment_card?: {
      brand: string
      last4: string
      exp_month: number
      exp_year: number
    } | null
    spouse_partner?: {
      first_name: string
      last_name: string
      email: string
      phone: string
      is_alternate_contact: boolean
    } | null
  }
  /** Stripe PaymentMethod ID for the booking card, resolved from PaymentIntent. */
  bookingPaymentMethodId?: string | null
  blackoutDates?: string[] | undefined
  allowedCheckInDays?: string[] | undefined
  checkInTime?: string | null | undefined
}

export function CheckInDialog({
  open,
  onOpenChange,
  reservation,
  bookingPaymentMethodId,
  blackoutDates,
  allowedCheckInDays,
  checkInTime,
}: CheckInDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkInNotes, setCheckInNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [showEarlyCheckInWarning, setShowEarlyCheckInWarning] = useState(false)

  // Incidentals card state
  const [incidentalsChoice, setIncidentalsChoice] = useState<'booking-card' | 'new-card' | 'skip'>('booking-card')
  const [setupIntentSecret, setSetupIntentSecret] = useState<string | null>(null)
  const [setupIntentLoading, setSetupIntentLoading] = useState(false)
  const [setupIntentError, setSetupIntentError] = useState<string | null>(null)
  const [newCardPaymentMethodId, setNewCardPaymentMethodId] = useState<string | null>(null)
  const hasBookablePaymentMethod = Boolean(bookingPaymentMethodId)

  const todayStr = asYyyyMmDd(new Date())
  const reservationStartStr = normalizeDateString(reservation.check_in_date)
  const isBlockedByBlackout =
    (blackoutDates ?? []).includes(todayStr) &&
    reservationStartStr === todayStr
  const todayDateLabel = formatDisplayDate(todayStr)
  const todayDay = dayOfWeekFromYyyyMmDd(todayStr)
  const isBlockedByCheckInDay =
    (allowedCheckInDays ?? []).length > 0 &&
    !(allowedCheckInDays ?? []).includes(todayDay) &&
    reservationStartStr <= todayStr

  // Calculate outstanding balance
  const outstandingBalance = Math.max(0, reservation.total_amount - reservation.paid_amount)
  const balanceInDollars = (outstandingBalance / 100).toFixed(2)
  const hasBalance = outstandingBalance > 0

  const rawSiteStatus = reservation.site?.status ?? null
  const siteStatusForUi =
    rawSiteStatus && rawSiteStatus in SITE_STATUS_BADGE_CLASS
      ? (rawSiteStatus as SiteStatusForBadge)
      : null
  const isSiteHousekeeping = rawSiteStatus === 'housekeeping'
  const housekeepingBlockMessage =
    'Cannot check in while the site is in housekeeping. Complete housekeeping first.'

  const parsePropertyTimeForReservationDate = (time?: string | null): Date | null => {
    if (!time) return null
    const [hour = 0, minute = 0] = time.split(':').map(Number)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null

    const reservationDate = new Date(`${reservationStartStr}T00:00:00`)
    if (Number.isNaN(reservationDate.getTime())) return null

    reservationDate.setHours(hour, minute, 0, 0)
    return reservationDate
  }

  const configuredCheckInDateTime = parsePropertyTimeForReservationDate(checkInTime)
  const isEarlyCheckInAttempt =
    reservationStartStr === todayStr &&
    configuredCheckInDateTime !== null &&
    new Date() < configuredCheckInDateTime

  const handleNewCardSelected = useCallback(async () => {
    if (setupIntentLoading || setupIntentSecret) return
    setSetupIntentLoading(true)
    setSetupIntentError(null)
    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}/check-in/setup-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to create setup intent')
      const data = await res.json()
      if (data.success && data.data?.client_secret) {
        setSetupIntentSecret(data.data.client_secret)
      } else {
        throw new Error(data.error?.message || 'Failed to create setup intent')
      }
    } catch {
      setSetupIntentError('Unable to set up card collection. You can skip this step.')
    } finally {
      setSetupIntentLoading(false)
    }
  }, [reservation.id, setupIntentLoading, setupIntentSecret])

  // Reset incidentals state when dialog opens
  useEffect(() => {
    if (!open) {
      setIncidentalsChoice('booking-card')
      setSetupIntentSecret(null)
      setSetupIntentError(null)
      setNewCardPaymentMethodId(null)
      return
    }
    setIncidentalsChoice(hasBookablePaymentMethod ? 'booking-card' : 'skip')
  }, [open])

  const handleCheckIn = async (forceProceed = false) => {
    setIsProcessing(true)
    setError(null)

    try {
      if (isEarlyCheckInAttempt && !forceProceed) {
        setShowEarlyCheckInWarning(true)
        return
      }

      if (isSiteHousekeeping) {
        setError(housekeepingBlockMessage)
        return
      }

      if (isBlockedByBlackout) {
        setError(
          `Check-in is not allowed today (${todayDateLabel}) due to blackout date restrictions.`
        )
        return
      }

      if (isBlockedByCheckInDay) {
        setError(
          `Check-in is not allowed today (${todayDateLabel}) due to check-in day restrictions.`
        )
        return
      }

      // Determine if payment is being collected
      const isCollectingPayment = hasBalance && paymentMethod && paymentMethod !== 'skip'

      // Resolve incidentals PaymentMethod ID
      let incidentalsPaymentMethodId: string | null = null

      if (incidentalsChoice === 'booking-card' && bookingPaymentMethodId) {
        incidentalsPaymentMethodId = bookingPaymentMethodId
      } else if (incidentalsChoice === 'new-card' && newCardPaymentMethodId) {
        incidentalsPaymentMethodId = newCardPaymentMethodId
      }
      // skip → null

      if (incidentalsChoice === 'booking-card' && !incidentalsPaymentMethodId) {
        setError('Booking card is unavailable. Please choose "Use a different card" or "Skip".')
        return
      }

      if (incidentalsChoice === 'new-card' && !incidentalsPaymentMethodId) {
        setError('Please save the new card before completing check-in.')
        return
      }

      const response = await fetch(`/api/v1/reservations/${reservation.id}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          balancePaidCents: isCollectingPayment ? outstandingBalance : 0,
          notes: checkInNotes.trim() || null,
          incidentalsPaymentMethodId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to check in guest')
      }

      toast({
        title: 'Check-in Successful',
        description: `${reservation.guest?.first_name} ${reservation.guest?.last_name} has been checked in to Site ${reservation.site?.site_number}`,
        variant: "success",
      })

      onOpenChange(false)
      router.refresh()
    } catch (err) {
      if (isAccessDeniedError(err)) {
        toast({
          title: 'Access denied',
          description: "You don't have permission for this action. Contact your property administrator if you believe this is an error.",
          variant: 'destructive',
          className: SEASON_ALERT_TOAST_CLASS,
        })
        return
      }
      console.error('Check-in error:', err)
      toast({
        title: 'Check-in failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Check In Guest
            </DialogTitle>
            <DialogDescription>
              Confirm guest arrival and complete check-in process
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 sm:py-4">
            {/* Guest Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Guest Information
              </h3>
              <div className="grid grid-cols-1 gap-3 p-3 rounded-lg bg-muted/50 sm:grid-cols-2 sm:gap-4 sm:p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Guest Name</p>
                  <p className="font-medium break-words">
                    {reservation.guest?.first_name} {reservation.guest?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confirmation #</p>
                  <p className="font-mono text-sm font-semibold break-all">{reservation.confirmation_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium break-all">{reservation.guest?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact Number</p>
                  <p className="font-medium break-all">{reservation.guest?.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium break-words">{reservation.guest?.address}</p>
                  <p className="font-medium break-words">{reservation.guest?.city}, {reservation.guest?.state} {reservation.guest?.zip_code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Spouse/Partner</p>
                  {reservation.spouse_partner ? (
                    <div className="space-y-0.5">
                      <p className="font-medium">{reservation.spouse_partner?.first_name} {reservation.spouse_partner?.last_name}</p>
                      <p className="font-medium break-all">{reservation.spouse_partner?.phone}</p>
                      <p className="font-medium break-all">{reservation.spouse_partner?.email}</p>
                    </div>
                  ) : (
                    <p className="font-medium">No spouse/partner</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Card</p>
                  {reservation.payment_card ? (
                    <div className="mt-1 flex items-center gap-2">
                      <PaymentCardLogo brand={reservation.payment_card.brand} />
                      <p className="font-medium break-all">
                        **** **** **** {reservation.payment_card.last4}
                      </p>
                    </div>
                  ) : (
                    <p className="font-medium">No card on file</p>
                  )}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Home className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Site</p>
                      <p className="font-medium mt-0.5 break-words">
                        {reservation.site?.site_name || `Site ${reservation.site?.site_number}`}
                      </p>
                    </div>
                    {rawSiteStatus ? (
                      <Badge
                        variant="outline"
                        className={`shrink-0 whitespace-nowrap ${siteStatusForUi
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
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Dates</p>
                    <p className="font-medium text-sm break-words">
                      {checkInDate} - {checkOutDate}
                    </p>
                    <p className="text-xs text-muted-foreground">{nights} nights</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Guests</p>
                    <p className="font-medium break-words">
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
              <Alert className="border-green-200 bg-green-50 dark:border-emerald-800/60 dark:bg-emerald-950/40 [&>svg]:text-green-600 dark:[&>svg]:text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription className="text-green-800 dark:text-emerald-100">
                  Reservation is fully paid. No additional payment required.
                </AlertDescription>
              </Alert>
            )}

            {/* Incidentals Card Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Incidentals Card-on-File
              </h3>
              <p className="text-xs text-muted-foreground">
                Collect a card for incidentals, damages, or additional charges during the stay.
              </p>

              <div className="space-y-2">
                {/* Option 1: Use booking card */}
                {reservation.payment_card ? (
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                    <input
                      type="radio"
                      name="incidentals"
                      value="booking-card"
                      checked={incidentalsChoice === 'booking-card'}
                      onChange={() => setIncidentalsChoice('booking-card')}
                      disabled={!hasBookablePaymentMethod}
                      className="accent-primary"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <PaymentCardLogo brand={reservation.payment_card.brand} />
                      <div>
                        <span className="text-sm font-medium">Use booking card</span>
                        <span className="text-xs text-muted-foreground block">
                          {reservation.payment_card.brand} **** {reservation.payment_card.last4}
                        </span>
                        {!hasBookablePaymentMethod ? (
                          <span className="text-xs text-amber-600 block">
                            Payment method ID not available for this card. Choose a different card.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </label>
                ) : null}

                {/* Option 2: New card */}
                <label
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    setIncidentalsChoice('new-card')
                    setNewCardPaymentMethodId(null)
                    void handleNewCardSelected()
                  }}
                >
                  <input
                    type="radio"
                    name="incidentals"
                    value="new-card"
                    checked={incidentalsChoice === 'new-card'}
                    onChange={() => {
                      setIncidentalsChoice('new-card')
                      setNewCardPaymentMethodId(null)
                      void handleNewCardSelected()
                    }}
                    disabled={setupIntentLoading}
                    className="accent-primary"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">Use a different card</span>
                    <span className="text-xs text-muted-foreground block">Collect a new card for incidentals</span>
                  </div>
                  {setupIntentLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </label>

                {/* Option 3: Skip */}
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                  <input
                    type="radio"
                    name="incidentals"
                    value="skip"
                    checked={incidentalsChoice === 'skip'}
                    onChange={() => setIncidentalsChoice('skip')}
                    className="accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">Skip — no card on file for incidentals</span>
                </label>
              </div>

              {/* New card input (shown when "new-card" is selected) */}
              {incidentalsChoice === 'new-card' && (
                <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
                  {setupIntentLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing secure card form...
                    </div>
                  ) : setupIntentError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="space-y-2">
                        <p>{setupIntentError}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleNewCardSelected()}
                        >
                          Retry loading card form
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : setupIntentSecret ? (
                    <>
                      <Elements stripe={stripePromise} options={{ clientSecret: setupIntentSecret, appearance: { theme: 'stripe' as const } }}>
                        <IncidentalsCardForm
                          onPaymentMethodId={(pmId) => setNewCardPaymentMethodId(pmId)}
                          setupIntentSecret={setupIntentSecret}
                        />
                      </Elements>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Card details are securely processed by Stripe
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Preparing card form...</p>
                  )}
                </div>
              )}
            </div>

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

            {isSiteHousekeeping && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{housekeepingBlockMessage}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={() => void handleCheckIn()} disabled={isProcessing || isSiteHousekeeping} className="w-full sm:w-auto">
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
      <AlertDialog open={showEarlyCheckInWarning} onOpenChange={setShowEarlyCheckInWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Early check-in warning</AlertDialogTitle>
            <AlertDialogDescription>
              This reservation is being checked in before the configured check-in time
              {checkInTime ? ` (${checkInTime})` : ''}. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowEarlyCheckInWarning(false)
                void handleCheckIn(true)
              }}
            >
              Continue check-in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

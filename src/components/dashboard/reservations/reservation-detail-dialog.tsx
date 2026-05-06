'use client'

import { useEffect, useState } from 'react'
import type { MoneyCents, ReservationStatus } from '@/contracts/booking'
import type { DashboardGuest, DashboardReservation } from '@/lib/dashboard/queries'
import type { BookingRulesConfig, RateDiscountsConfig } from '@/lib/config/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AmericanExpressFlatRoundedIcon,
  DiscoverFlatRoundedIcon,
  GenericFlatRoundedIcon,
  MastercardFlatRoundedIcon,
  VisaFlatRoundedIcon,
} from 'react-svg-credit-card-payment-icons'
import { cn } from '@/lib/utils'
import { ReservationActions } from '@/components/admin/reservation-actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TransactionHistoryTab } from '@/components/dashboard/reservations/transaction-history-tab'

const statusTextColors: Record<ReservationStatus, string> = {
  pending: 'text-yellow-600',
  confirmed: 'text-blue-600',
  checked_in: 'text-green-600',
  checked_out: 'text-gray-600',
  cancelled: 'text-red-600',
  no_show: 'text-orange-600',
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function humanizePaymentMethod(method: string): string {
  const normalized = method.trim()
  if (normalized.length === 0) return '—'
  return normalized
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

type PaymentCardDisplay = {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

function PaymentCardLogo({ brand }: { brand: string }) {
  const normalized = brand.trim().toLowerCase()
  switch (normalized) {
    case 'visa':
      return <VisaFlatRoundedIcon width={56} />
    case 'mastercard':
      return <MastercardFlatRoundedIcon width={56} />
    case 'amex':
    case 'american express':
    case 'americanexpress':
      return <AmericanExpressFlatRoundedIcon width={56} />
    case 'discover':
      return <DiscoverFlatRoundedIcon width={56} />
    default:
      return <GenericFlatRoundedIcon width={56} />
  }
}

function reservationToSheetGuest(r: DashboardReservation): DashboardGuest {
  return {
    id: r.guestId,
    name: r.guestName,
    email: r.guestEmail,
    phone: null,
    totalStays: 0,
    totalSpent: 0 as MoneyCents,
    lastVisit: null,
    firstVisit: null,
  }
}

export type ReservationDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: DashboardReservation | null
  rateDiscountsConfig?: RateDiscountsConfig | null | undefined
  bookingRulesConfig?: BookingRulesConfig | null | undefined
  checkInTime?: string | null
  checkOutTime?: string | null
  /** When omitted, Primary Guest is static (no navigation). */
  onPrimaryGuestClick?: (guest: DashboardGuest) => void
  overlayClassName?: string
  contentClassName?: string
  canModify?: boolean
  canCheckIn?: boolean
  canCheckOut?: boolean
  canCancel?: boolean
}

export function ReservationDetailDialog({
  open,
  onOpenChange,
  reservation,
  rateDiscountsConfig,
  bookingRulesConfig,
  checkInTime,
  checkOutTime,
  onPrimaryGuestClick,
  overlayClassName,
  contentClassName,
  canModify = true,
  canCheckIn = true,
  canCheckOut = true,
  canCancel = true,
}: ReservationDetailDialogProps) {
  const [previewLoading, setPreviewLoading] = useState(false)
  const [paymentCard, setPaymentCard] = useState<PaymentCardDisplay | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)
  const [incidentalsCard, setIncidentalsCard] = useState<PaymentCardDisplay | null>(null)

  useEffect(() => {
    if (!reservation?.id) return

    let cancelled = false
    setPreviewLoading(true)
    setPaymentCard(null)
    setPaymentMethod(null)
    setIncidentalsCard(null)

    fetch(`/api/v1/reservations/${reservation.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        const method = json?.data?.payment_method
        if (typeof method === 'string' && method.length > 0) {
          setPaymentMethod(method)
        }
        const pc = json?.data?.payment_card
        if (
          json?.success === true &&
          pc &&
          typeof pc.last4 === 'string' &&
          typeof pc.brand === 'string' &&
          typeof pc.exp_month === 'number' &&
          typeof pc.exp_year === 'number'
        ) {
          setPaymentCard({
            brand: pc.brand,
            last4: pc.last4,
            exp_month: pc.exp_month,
            exp_year: pc.exp_year,
          })
        }
        // Incidentals card
        const ic = json?.data?.incidentals_card
        if (
          json?.success === true &&
          ic &&
          typeof ic.last4 === 'string' &&
          typeof ic.brand === 'string' &&
          typeof ic.exp_month === 'number' &&
          typeof ic.exp_year === 'number'
        ) {
          setIncidentalsCard({
            brand: ic.brand,
            last4: ic.last4,
            exp_month: ic.exp_month,
            exp_year: ic.exp_year,
          })
        }
      })
      .catch(() => {
        // keep paymentCard/paymentMethod null
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reservation?.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(overlayClassName !== undefined ? { overlayClassName } : {})}
        className={cn('max-w-xl', contentClassName)}
      >
        {reservation && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 pr-10">
                <DialogTitle className="shrink-0">Reservation {reservation.confirmationNumber}</DialogTitle>
                <ReservationActions
                  reservationId={reservation.id}
                  confirmationNumber={reservation.confirmationNumber}
                  guestName={reservation.guestName}
                  status={reservation.status}
                  checkIn={reservation.checkIn}
                  checkOut={reservation.checkOut}
                  numAdults={reservation.numAdults}
                  numChildren={reservation.numChildren}
                  numPets={reservation.numPets}
                  specialRequests={reservation.specialRequests}
                  siteNumber={reservation.siteNumber}
                  siteName={reservation.siteName}
                  pricePerNight={reservation.pricePerNight}
                  weeklyRateCents={reservation.weeklyRateCents ?? null}
                  monthlyRateCents={reservation.monthlyRateCents ?? null}
                  bookingType={reservation.bookingType}
                  totalAmount={reservation.totalAmount}
                  paidAmount={reservation.paidAmount}
                  hasOutstandingBalance={Math.max(0, reservation.totalAmount - reservation.paidAmount) > 0}
                  canRefund={
                    (reservation.status === 'cancelled' || reservation.status === 'confirmed') &&
                    reservation.paidAmount > 0 &&
                    reservation.refundAmount < reservation.paidAmount
                  }
                  maxRefundableCents={Math.max(0, reservation.paidAmount - reservation.refundAmount)}
                  rateDiscountsConfig={rateDiscountsConfig}
                  blackoutDates={bookingRulesConfig?.blackout_dates ?? []}
                  allowedCheckInDays={bookingRulesConfig?.allowed_checkin_days ?? []}
                  allowedCheckOutDays={bookingRulesConfig?.allowed_checkout_days ?? []}
                  checkInTime={checkInTime}
                  checkOutTime={checkOutTime}
                  canModify={canModify}
                  canCheckIn={canCheckIn}
                  canCheckOut={canCheckOut}
                  canCancel={canCancel}
                />
              </div>
              <DialogDescription className="capitalize">
                Detailed information for {reservation.guestName}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="details" className="mt-3">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="transactions">Transaction History</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
            <div className="space-y-6 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                {onPrimaryGuestClick ? (
                  <button
                    type="button"
                    className="select-none cursor-pointer rounded-md border bg-muted/40 p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onPrimaryGuestClick(reservationToSheetGuest(reservation))}
                    aria-label="View guest profile"
                  >
                    <div className="text-xs font-medium text-muted-foreground">Primary Guest</div>
                    <div className="mt-1 font-medium capitalize">{reservation.guestName}</div>
                    <div className="text-xs text-muted-foreground">{reservation.guestEmail}</div>
                  </button>
                ) : (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs font-medium text-muted-foreground">Primary Guest</div>
                    <div className="mt-1 font-medium capitalize">{reservation.guestName}</div>
                    <div className="text-xs text-muted-foreground">{reservation.guestEmail}</div>
                  </div>
                )}
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Site</div>
                  <div className="mt-1 font-medium">
                    {reservation.siteName}{' '}
                    {reservation.siteNumber && `(#${reservation.siteNumber})`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {reservation.bookingType.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Stay</div>
                  <div className="mt-1 font-medium">
                    {formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {reservation.numNights} nights • {reservation.numAdults + reservation.numChildren} guests •{' '}
                    {reservation.numPets} pets
                  </div>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-medium text-muted-foreground">Status</div>
                    <span
                      className={`${statusTextColors[reservation.status]} shrink-0 whitespace-nowrap text-xs font-medium capitalize`}
                    >
                      {reservation.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Booked</span> {formatDate(reservation.createdAt)}
                  </div>
                </div>
              </div>

              <div className="rounded-md border bg-muted/40 p-3">
                <div className="text-xs font-medium text-muted-foreground">Payment Method</div>
                <div className="mt-1 font-medium">
                  {paymentMethod ? humanizePaymentMethod(paymentMethod) : '—'}
                </div>
                {previewLoading ? (
                  <div className="mt-2 text-xs text-muted-foreground">Loading card…</div>
                ) : paymentCard ? (
                  <div className="mt-2 inline-flex items-center gap-3 align-middle">
                    <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center">
                      <PaymentCardLogo brand={paymentCard.brand} />
                    </span>
                    <span className="font-mono text-base text-foreground">
                      **** **** **** {paymentCard.last4}
                    </span>
                  </div>
                ) : null}
              </div>

              {incidentalsCard ? (
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Incidentals Card-on-File</div>
                  <div className="mt-2 inline-flex items-center gap-3 align-middle">
                    <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center">
                      <PaymentCardLogo brand={incidentalsCard.brand} />
                    </span>
                    <span className="font-mono text-base text-foreground">
                      **** **** **** {incidentalsCard.last4}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border bg-muted/40 p-3">
                <div className="text-xs font-medium text-muted-foreground">Financials</div>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Total</dt>
                    <dd className="font-medium">{formatMoney(reservation.totalAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Paid</dt>
                    <dd className="font-medium">{formatMoney(reservation.paidAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Refunded</dt>
                    <dd className="font-medium">{formatMoney(reservation.refundAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Balance</dt>
                    <dd className="font-medium">
                      {formatMoney(Math.max(0, reservation.totalAmount - reservation.paidAmount))}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4">
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Guest special requests</div>
                  <div className="mt-1.5 whitespace-pre-wrap text-sm">
                    {reservation.specialRequests?.trim() || 'None'}
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Check-in notes</div>
                  <div className="mt-1.5 whitespace-pre-wrap text-sm">
                    {reservation.checkInNotes?.trim() || 'None'}
                  </div>
                </div>
              </div>
            </div>
              </TabsContent>

              <TabsContent value="transactions">
                <TransactionHistoryTab
                  reservationId={reservation.id}
                  confirmationNumber={reservation.confirmationNumber}
                  guestName={reservation.guestName}
                  guestId={reservation.guestId}
                  canRecordPayment={true}
                  totalAmountCents={reservation.totalAmount}
                  paidAmountCents={reservation.paidAmount}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

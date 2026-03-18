'use client'

/**
 * Guest Reservations Sheet
 *
 * Slide-over panel showing all reservations for a specific guest.
 * Fetches from GET /api/v1/properties/[propertyId]/reservations?guestId=[guestId].
 */

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, CalendarDays, AlertCircle, Mail } from 'lucide-react'
import type { DashboardGuest } from '@/lib/dashboard/queries'
import {
  AmericanExpressFlatRoundedIcon,
  DiscoverFlatRoundedIcon,
  GenericFlatRoundedIcon,
  MastercardFlatRoundedIcon,
  VisaFlatRoundedIcon,
} from 'react-svg-credit-card-payment-icons'

interface GuestReservationsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest: DashboardGuest
  propertyId: string
}

type ReservationItem = {
  id: string
  confirmationNumber: string
  checkInDate: string
  checkOutDate: string
  nights: number
  totalAmountDollars: number
  paidAmountDollars: number
  balanceDollars: number
  status: string
  paymentStatus: string | null
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

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

const statusTextColors: Record<string, string> = {
  pending: 'text-yellow-600',
  confirmed: 'text-blue-600',
  checked_in: 'text-green-600',
  checked_out: 'text-gray-600',
  cancelled: 'text-red-600',
  no_show: 'text-orange-600',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMoney(dollars: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  if (!first) return '?'
  if (parts.length >= 2) {
    const second = parts[1]
    return ((first[0] ?? '') + (second?.[0] ?? '')).toUpperCase().slice(0, 2)
  }
  return first.slice(0, 2).toUpperCase() || '?'
}

export function GuestReservationsSheet({
  open,
  onOpenChange,
  guest,
  propertyId,
}: GuestReservationsSheetProps) {
  const [reservations, setReservations] = useState<ReservationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [paymentCard, setPaymentCard] = useState<PaymentCardDisplay | null>(null)

  useEffect(() => {
    if (!open || !propertyId || !guest?.id) return

    let cancelled = false
    setIsLoading(true)
    setFetchError(null)
    setReservations([])
    setPaymentCard(null)

    const url = `/api/v1/properties/${propertyId}/reservations?guestId=${encodeURIComponent(guest.id)}&limit=50`
    fetch(url)
      .then(async (res) => {
        let json: { data?: { reservations?: unknown }; error?: { message?: string; details?: { message?: string } } }
        try {
          json = await res.json()
        } catch {
          throw new Error('Invalid response from server')
        }
        if (cancelled) return
        if (!res.ok) {
          const msg =
            json?.error?.details && typeof json.error.details === 'object' && 'message' in json.error.details
              ? (json.error.details as { message?: string }).message
              : json?.error?.message
          throw new Error(msg ?? 'Failed to load reservations')
        }
        const list = json?.data?.reservations
        if (!cancelled) {
          setReservations(Array.isArray(list) ? (list as ReservationItem[]) : [])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load reservations')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, guest?.id, propertyId])

  useEffect(() => {
    const firstReservationId = reservations[0]?.id
    if (!open || !firstReservationId) return

    let cancelled = false
    setPreviewLoading(true)
    setPaymentCard(null)

    fetch(`/api/v1/reservations/${firstReservationId}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
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
      })
      .catch(() => {
        // Keep paymentCard null
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, reservations])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Reservations</SheetTitle>
          <SheetDescription>
            All bookings for this guest
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 rounded-lg border bg-muted/30 p-4 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-xs bg-slate-200 text-slate-600 font-medium">
                {getInitials(guest.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-foreground">{guest.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{guest.email}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {guest.totalStays} stay{guest.totalStays !== 1 ? 's' : ''} total
              </p>
            </div>
          </div>
          
          <div className="text-md">
              {previewLoading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : paymentCard ? (
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex h-7 w-10 items-center justify-center">
                    <PaymentCardLogo brand={paymentCard.brand} />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    **** **** **** {paymentCard.last4}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  No card payment on file for this guest
                </span>
              )}
            </div>
        </div>

        {isLoading && (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading reservations…</p>
          </div>
        )}

        {fetchError && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {fetchError}
          </div>
        )}

        {!isLoading && !fetchError && reservations.length === 0 && (
          <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No reservations</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This guest has no reservations yet.
            </p>
          </div>
        )}

        {!isLoading && reservations.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Reservations ({reservations.length})
            </h3>
            <div className="space-y-3">
              {reservations.map((res) => (
                <div
                  key={res.id}
                  className="rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold tracking-wide text-foreground">
                        {res.confirmationNumber}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(res.checkInDate)} – {formatDate(res.checkOutDate)}
                        <span className="ml-1.5 text-muted-foreground/80">
                          · {res.nights} night{res.nights !== 1 ? 's' : ''}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium capitalize ${statusTextColors[res.status] ?? 'text-muted-foreground'}`}
                    >
                      {statusLabels[res.status] ?? res.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 rounded-md bg-muted/40 p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-medium">{formatMoney(res.totalAmountDollars)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="font-medium">{formatMoney(res.paidAmountDollars)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className={`font-medium ${res.balanceDollars > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                        {res.balanceDollars > 0
                          ? `${formatMoney(res.balanceDollars)} owed`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

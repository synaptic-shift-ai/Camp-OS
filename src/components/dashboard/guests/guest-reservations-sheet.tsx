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
import { Badge } from '@/components/ui/badge'
import { Loader2, CalendarDays, DollarSign, AlertCircle, Mail, User } from 'lucide-react'
import type { DashboardGuest } from '@/lib/dashboard/queries'

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

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  confirmed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  checked_in: 'bg-green-500/10 text-green-600 border-green-500/20',
  checked_out: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
  no_show: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
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

export function GuestReservationsSheet({
  open,
  onOpenChange,
  guest,
  propertyId,
}: GuestReservationsSheetProps) {
  const [reservations, setReservations] = useState<ReservationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setIsLoading(true)
    setFetchError(null)
    setReservations([])

    fetch(`/api/v1/properties/${propertyId}/reservations?guestId=${guest.id}&limit=50`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json?.error?.message ?? 'Failed to load reservations')
        }
        setReservations(json.data.reservations ?? [])
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load reservations')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [open, guest.id, propertyId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Reservations</SheetTitle>

          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <User className="h-4 w-4" strokeWidth={3} />
              {guest.name}
            </div>

            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {guest.email} · {guest.totalStays} stay{guest.totalStays !== 1 ? "s" : ""}
            </div>
          </div>
        </SheetHeader>


        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {fetchError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {fetchError}
          </div>
        )}

        {!isLoading && !fetchError && reservations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No reservations found for this guest.</p>
          </div>
        )}

        {!isLoading && reservations.length > 0 && (
          <div className="space-y-3">
            {reservations.map((res) => (
              <div
                key={res.id}
                className="rounded-lg border bg-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold tracking-wide">
                      #{res.confirmationNumber}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)}
                      <span className="ml-2 text-muted-foreground/60">
                        ({res.nights} night{res.nights !== 1 ? 's' : ''})
                      </span>
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`${statusColors[res.status] ?? ''} whitespace-nowrap text-xs`}
                  >
                    {statusLabels[res.status] ?? res.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>
                      Paid{' '}
                      <span className="font-medium text-foreground">
                        {formatMoney(res.paidAmountDollars)}
                      </span>
                      {' '}/ {formatMoney(res.totalAmountDollars)}
                    </span>
                  </div>
                  {res.balanceDollars > 0 && (
                    <span className="text-orange-600 font-medium">
                      {formatMoney(res.balanceDollars)} owed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

'use client'

/**
 * Today's Arrivals Card Component
 *
 * Dashboard widget showing guests checking in today.
 * Displays reservation details with quick check-in action.
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, User, Home, AlertTriangle } from 'lucide-react'
import { CheckInDialog } from './check-in-dialog'
import { useToast } from '@/hooks/use-toast'
import type { Reservation } from '@/lib/booking/types'

interface TodaysArrivalsCardProps {
  arrivals: Array<
    Reservation & {
      guest?: { first_name: string; last_name: string; email: string }
      site?: { site_number: string; site_name: string | null; status?: string | null }
    }
  >
  checkInTime?: string | null | undefined
  canManageCheckInOut?: boolean
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function TodaysArrivalsCard({
  arrivals,
  checkInTime,
  canManageCheckInOut = true,
}: TodaysArrivalsCardProps) {
  const { toast } = useToast()
  const [selectedReservation, setSelectedReservation] = useState<
    (Reservation & {
      guest?: { first_name: string; last_name: string; email: string }
      site?: { site_number: string; site_name: string | null; status?: string | null }
    }) | null
  >(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loadingReservationId, setLoadingReservationId] = useState<string | null>(null)
  const [bookingPaymentMethodId, setBookingPaymentMethodId] = useState<string | null>(null)
  type ArrivalFilter = 'all' | 'late' | 'waiting' | 'checked_in'
  const [activeFilter, setActiveFilter] = useState<ArrivalFilter>('all')

  const handleCheckIn = async (reservation: typeof arrivals[0]) => {
    setLoadingReservationId(reservation.id)
    try {
      const response = await fetch(`/api/v1/reservations/${reservation.id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch reservation details')
      }

      const payload = await response.json()
      if (!payload?.data) {
        throw new Error('Reservation details response is missing data')
      }

      setSelectedReservation(payload.data)
      setBookingPaymentMethodId(payload.data?.booking_payment_method_id ?? null)
      setDialogOpen(true)
    } catch (err) {
      console.error('Failed to fetch reservation details for check-in:', err)
      toast({
        title: 'Unable to open check-in',
        description: 'Could not load full reservation details. Please try again.',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setLoadingReservationId(null)
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (arrivals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-xl font-semibold sm:text-2xl">Today&apos;s Arrivals</span>
          </CardTitle>
          <CardDescription>Guests checking in today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No arrivals scheduled for today</p>
            <p className="text-xs text-muted-foreground mt-1">Check back tomorrow!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get today's date for comparison
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Helper to check if a reservation is a late arrival
  const isLateArrival = (reservation: typeof arrivals[0]) => {
    const checkInDate = new Date(reservation.check_in_date)
    checkInDate.setHours(0, 0, 0, 0)
    return checkInDate.getTime() < today.getTime()
  }

  // Separate arrivals by status and late arrivals
  const lateArrivals = arrivals.filter((r) => r.status === 'confirmed' && isLateArrival(r))
  const todaysPendingCheckIns = arrivals.filter((r) => r.status === 'confirmed' && !isLateArrival(r))
  const completedCheckIns = arrivals.filter((r) => r.status === 'checked_in')
  const pendingCheckIns = [...lateArrivals, ...todaysPendingCheckIns]

  const filters: { key: ArrivalFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: arrivals.length },
    { key: 'late', label: 'Late', count: lateArrivals.length },
    { key: 'waiting', label: 'Waiting', count: todaysPendingCheckIns.length },
    { key: 'checked_in', label: 'Checked In', count: completedCheckIns.length },
  ]

  const getNights = (checkIn: string, checkOut: string) =>
    Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Arrivals
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {lateArrivals.length > 0 && (
                  <span className="text-red-600">{lateArrivals.length} late • </span>
                )}
                {todaysPendingCheckIns.length} today
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {lateArrivals.length > 0 && (
                <Badge variant="destructive">
                  {lateArrivals.length} late
                </Badge>
              )}
              {todaysPendingCheckIns.length > 0 && (
                <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                  {todaysPendingCheckIns.length} waiting
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
            <div className="flex flex-wrap gap-2 px-4 sm:px-6 pt-3 border-t border-border/50">
              {filters.map(({ key, label, count }) => (
                <Button
                  key={key}
                  variant={activeFilter === key ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setActiveFilter(key)}
                >
                  {label} ({count})
                </Button>
              ))}
            </div>
        <CardContent>
          <div className="space-y-3">
            {/* Late Arrivals - Show first with red styling */}
            {activeFilter === 'all' || activeFilter === 'late' ? (lateArrivals.map((reservation) => {
              const outstandingBalance = reservation.total_amount - reservation.paid_amount
              const hasBalance = outstandingBalance > 0
              const checkInDate = new Date(reservation.check_in_date).toLocaleDateString()

              return (
                <div
                  key={reservation.id}
                  className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50/30 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/60 dark:bg-red-950/25"
                >
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 dark:text-red-400" />
                      <p className="font-medium truncate capitalize">
                        {reservation.guest?.first_name} {reservation.guest?.last_name}
                      </p>
                      <Badge variant="destructive" className="text-xs">
                        Late
                      </Badge>
                      {hasBalance && (
                        <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-xs text-yellow-700 dark:border-yellow-900/60 dark:bg-yellow-950/25 dark:text-yellow-300">
                          Balance Due
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        Site {reservation.site?.site_number}
                      </span>
                      <span className="text-xs text-red-600 dark:text-red-400">
                        Expected: {checkInDate}
                      </span>
                    </div>
                    {hasBalance && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        ${(outstandingBalance / 100).toFixed(2)} balance due
                      </p>
                    )}
                  </div>
                  {canManageCheckInOut ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCheckIn(reservation)}
                      disabled={loadingReservationId === reservation.id}
                      className="w-full flex-shrink-0 sm:ml-3 sm:w-auto"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Check In
                    </Button>
                  ) : null}
                </div>
              )
            })) : null}

            {/* Today's Pending Check-ins */}
            {activeFilter === 'all' || activeFilter === 'waiting' ? (todaysPendingCheckIns.map((reservation) => {
              const outstandingBalance = reservation.total_amount - reservation.paid_amount
              const hasBalance = outstandingBalance > 0

              return (
                <div
                  key={reservation.id}
                  className="flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50/30 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-orange-900/60 dark:bg-orange-950/25"
                >
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-600 flex-shrink-0 dark:text-orange-400" />
                      <p className="font-medium truncate capitalize">
                        {reservation.guest?.first_name} {reservation.guest?.last_name}
                      </p>
                      {hasBalance && (
                        <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-xs text-yellow-700 dark:border-yellow-900/60 dark:bg-yellow-950/25 dark:text-yellow-300">
                          Balance Due
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1">
                        <Home className="h-3 w-3" />
                        <span className="break-words">
                          {reservation.site?.site_name || `Site ${reservation.site?.site_number}`} • {formatDate(reservation.check_in_date)} - {formatDate(reservation.check_out_date)} • {getNights(reservation.check_in_date, reservation.check_out_date)} {getNights(reservation.check_in_date, reservation.check_out_date) === 1 ? 'night' : 'nights'}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {reservation.num_adults + reservation.num_children} guests
                      </span>
                    </div>
                    {hasBalance && (
                      <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                        ${(outstandingBalance / 100).toFixed(2)} balance due at check-in
                      </p>
                    )}
                  </div>
                  {canManageCheckInOut ? (
                    <Button
                      size="sm"
                      onClick={() => handleCheckIn(reservation)}
                      disabled={loadingReservationId === reservation.id}
                      className="w-full flex-shrink-0 sm:ml-3 sm:w-auto"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Check In
                    </Button>
                  ) : null}
                </div>
              )
            })) : null}

            {/* Completed Check-ins */}
            {activeFilter === 'all' || activeFilter === 'checked_in' ? (completedCheckIns.map((reservation) => (
              <div
                key={reservation.id}
                className="flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50/30 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-green-900/60 dark:bg-green-950/25"
              >
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 dark:text-green-400" />
                    <p className="font-medium truncate capitalize">
                      {reservation.guest?.first_name} {reservation.guest?.last_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Home className="h-3 w-3" />
                      Site {reservation.site?.site_number}
                    </span>
                    {reservation.checked_in_at && (
                      <span className="text-xs text-green-600 dark:text-green-400" suppressHydrationWarning>
                        Checked in at {formatTime(reservation.checked_in_at)}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="w-fit border-green-200 bg-green-100 text-green-700 dark:border-green-900/60 dark:bg-green-950/35 dark:text-green-300">
                  Checked In
                </Badge>
              </div>
            ))) : null}

            {activeFilter === 'late' && lateArrivals.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No late arrivals</div>
            )}
            {activeFilter === 'waiting' && todaysPendingCheckIns.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No arrivals waiting for check-in</div>
            )}
            {activeFilter === 'checked_in' && completedCheckIns.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No check-ins completed yet</div>
            )}
            {/* Show message if all check-ins complete */}
            {activeFilter === 'all' && pendingCheckIns.length === 0 && completedCheckIns.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>All arrivals checked in!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Check-in Dialog */}
      {selectedReservation && (
        <CheckInDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          reservation={selectedReservation}
          bookingPaymentMethodId={bookingPaymentMethodId}
          checkInTime={checkInTime}
        />
      )}
    </>
  )
}

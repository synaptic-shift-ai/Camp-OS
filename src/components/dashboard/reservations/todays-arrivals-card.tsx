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
import { CheckCircle, Clock, Users, Tent, AlertTriangle, LogIn, Moon } from 'lucide-react'
import { CheckInDialog } from './check-in-dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
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

type ArrivalReservation = TodaysArrivalsCardProps['arrivals'][number]
type ArrivalFilter = 'all' | 'late' | 'expected' | 'upcoming'

function parseCheckInTimeMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const [hoursRaw, minutesRaw] = time.split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

function formatExpectedCheckInTime(time: string | null | undefined): string {
  const minutes = parseCheckInTimeMinutes(time)
  if (minutes === null) return 'Expected today'

  const date = new Date()
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return `Expected ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function getNights(checkIn: string, checkOut: string) {
  return Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
}

function getSiteLabel(reservation: ArrivalReservation) {
  if (reservation.site?.site_name) return reservation.site.site_name
  return `Site ${reservation.site?.site_number ?? '—'}`
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-background text-foreground hover:bg-muted/50',
      )}
    >
      {label}
      <span
        className={cn(
          'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold',
          active
            ? 'bg-primary-foreground/20 text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function SectionHeader({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: 'late' | 'expected' | 'upcoming'
}) {
  const toneStyles = {
    late: {
      text: 'text-red-600 dark:text-red-400',
      badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    },
    expected: {
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    },
    upcoming: {
      text: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    },
  }[tone]

  return (
    <div className="flex items-center gap-2 pt-1">
      <span className={cn('text-xs font-bold uppercase tracking-wide', toneStyles.text)}>{label}</span>
      <span
        className={cn(
          'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold',
          toneStyles.badge,
        )}
      >
        {count}
      </span>
    </div>
  )
}

function ArrivalCard({
  reservation,
  variant,
  checkInTime,
  canManageCheckInOut,
  loadingReservationId,
  onCheckIn,
}: {
  reservation: ArrivalReservation
  variant: 'late' | 'expected' | 'upcoming'
  checkInTime?: string | null | undefined
  canManageCheckInOut: boolean
  loadingReservationId: string | null
  onCheckIn: (reservation: ArrivalReservation) => void
}) {
  const nights = getNights(reservation.check_in_date, reservation.check_out_date)
  const guestCount = reservation.num_adults + reservation.num_children

  const variantStyles = {
    late: {
      container: 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20',
      icon: AlertTriangle,
      iconClass: 'text-red-600 dark:text-red-400',
      badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      label: 'Late',
    },
    expected: {
      container: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20',
      icon: Clock,
      iconClass: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      label: 'Expected',
    },
    upcoming: {
      container: 'border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20',
      icon: Clock,
      iconClass: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      label: 'Upcoming',
    },
  }[variant]

  const StatusIcon = variantStyles.icon

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between',
        variantStyles.container,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <StatusIcon className={cn('h-4 w-4 shrink-0', variantStyles.iconClass)} />
          <p className="truncate font-semibold capitalize">
            {reservation.guest?.first_name} {reservation.guest?.last_name}
          </p>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              variantStyles.badge,
            )}
          >
            {variantStyles.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Tent className="h-3.5 w-3.5" />
            {getSiteLabel(reservation)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatExpectedCheckInTime(checkInTime)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5" />
            {nights} {nights === 1 ? 'night' : 'nights'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
          </span>
        </div>
      </div>
      {canManageCheckInOut ? (
        <Button
          size="sm"
          onClick={() => onCheckIn(reservation)}
          disabled={loadingReservationId === reservation.id}
          className="w-full shrink-0 bg-rose-500 text-white hover:bg-rose-600 sm:w-auto"
        >
          <LogIn className="mr-1.5 h-4 w-4" />
          Check In
        </Button>
      ) : null}
    </div>
  )
}

export function TodaysArrivalsCard({
  arrivals,
  checkInTime,
  canManageCheckInOut = true,
}: TodaysArrivalsCardProps) {
  const { toast } = useToast()
  const [selectedReservation, setSelectedReservation] = useState<ArrivalReservation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loadingReservationId, setLoadingReservationId] = useState<string | null>(null)
  const [bookingPaymentMethodId, setBookingPaymentMethodId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<ArrivalFilter>('all')

  const handleCheckIn = async (reservation: ArrivalReservation) => {
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const checkInMinutes = parseCheckInTimeMinutes(checkInTime)
  const isPastCheckInTime = checkInMinutes !== null && nowMinutes >= checkInMinutes
  const isExpectedWindow =
    checkInMinutes !== null && nowMinutes >= checkInMinutes && nowMinutes < checkInMinutes + 60

  const isTodayArrival = (reservation: ArrivalReservation) => {
    const checkInDate = new Date(reservation.check_in_date)
    checkInDate.setHours(0, 0, 0, 0)
    return checkInDate.getTime() === today.getTime()
  }

  const isPastDateArrival = (reservation: ArrivalReservation) => {
    const checkInDate = new Date(reservation.check_in_date)
    checkInDate.setHours(0, 0, 0, 0)
    return checkInDate.getTime() < today.getTime()
  }

  const isLateArrival = (reservation: ArrivalReservation) =>
    isPastDateArrival(reservation) ||
    (isTodayArrival(reservation) && isPastCheckInTime && !isExpectedWindow)

  const isExpectedArrival = (reservation: ArrivalReservation) =>
    isTodayArrival(reservation) && isExpectedWindow

  const isUpcomingArrival = (reservation: ArrivalReservation) =>
    isTodayArrival(reservation) && !isPastCheckInTime

  const pendingArrivals = arrivals.filter((r) => r.status === 'confirmed')
  const completedCheckIns = arrivals.filter((r) => r.status === 'checked_in')

  const lateArrivals = pendingArrivals.filter(isLateArrival)
  const expectedArrivals = pendingArrivals.filter(isExpectedArrival)
  const upcomingArrivals = pendingArrivals.filter(
    (r) => !isLateArrival(r) && !isExpectedArrival(r) && isUpcomingArrival(r),
  )

  const scheduledTodayCount = pendingArrivals.filter((r) => {
    const checkInDate = new Date(r.check_in_date)
    checkInDate.setHours(0, 0, 0, 0)
    return checkInDate.getTime() === today.getTime() || checkInDate.getTime() < today.getTime()
  }).length

  const filters: { key: ArrivalFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: pendingArrivals.length },
    { key: 'late', label: 'Late', count: lateArrivals.length },
    { key: 'expected', label: 'Expected', count: expectedArrivals.length },
    { key: 'upcoming', label: 'Upcoming', count: upcomingArrivals.length },
  ]

  const showLate = activeFilter === 'all' || activeFilter === 'late'
  const showExpected = activeFilter === 'all' || activeFilter === 'expected'
  const showUpcoming = activeFilter === 'all' || activeFilter === 'upcoming'

  const visibleLate = showLate ? lateArrivals : []
  const visibleExpected = showExpected ? expectedArrivals : []
  const visibleUpcoming = showUpcoming ? upcomingArrivals : []

  if (arrivals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-xl font-semibold sm:text-2xl">Arrivals</span>
          </CardTitle>
          <CardDescription>0 scheduled today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No arrivals scheduled for today</p>
            <p className="mt-1 text-xs text-muted-foreground">Check back tomorrow!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Arrivals
            </CardTitle>
            <CardDescription className="text-sm">
              {scheduledTodayCount} scheduled today
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map(({ key, label, count }) => (
              <FilterPill
                key={key}
                label={label}
                count={count}
                active={activeFilter === key}
                onClick={() => setActiveFilter(key)}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {visibleLate.length > 0 ? (
              <div className="space-y-2">
                {activeFilter === 'all' && (
                  <SectionHeader label="Late" count={visibleLate.length} tone="late" />
                )}
                {visibleLate.map((reservation) => (
                  <ArrivalCard
                    key={reservation.id}
                    reservation={reservation}
                    variant="late"
                    checkInTime={checkInTime}
                    canManageCheckInOut={canManageCheckInOut}
                    loadingReservationId={loadingReservationId}
                    onCheckIn={handleCheckIn}
                  />
                ))}
              </div>
            ) : null}

            {visibleExpected.length > 0 ? (
              <div className="space-y-2">
                {activeFilter === 'all' && (
                  <SectionHeader label="Expected" count={visibleExpected.length} tone="expected" />
                )}
                {visibleExpected.map((reservation) => (
                  <ArrivalCard
                    key={reservation.id}
                    reservation={reservation}
                    variant="expected"
                    checkInTime={checkInTime}
                    canManageCheckInOut={canManageCheckInOut}
                    loadingReservationId={loadingReservationId}
                    onCheckIn={handleCheckIn}
                  />
                ))}
              </div>
            ) : null}

            {visibleUpcoming.length > 0 ? (
              <div className="space-y-2">
                {activeFilter === 'all' && (
                  <SectionHeader label="Upcoming" count={visibleUpcoming.length} tone="upcoming" />
                )}
                {visibleUpcoming.map((reservation) => (
                  <ArrivalCard
                    key={reservation.id}
                    reservation={reservation}
                    variant="upcoming"
                    checkInTime={checkInTime}
                    canManageCheckInOut={canManageCheckInOut}
                    loadingReservationId={loadingReservationId}
                    onCheckIn={handleCheckIn}
                  />
                ))}
              </div>
            ) : null}

            {activeFilter === 'late' && lateArrivals.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No late arrivals</div>
            )}
            {activeFilter === 'expected' && expectedArrivals.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No expected arrivals</div>
            )}
            {activeFilter === 'upcoming' && upcomingArrivals.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No upcoming arrivals</div>
            )}

            {pendingArrivals.length === 0 && completedCheckIns.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>All arrivals checked in!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedReservation ? (
        <CheckInDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          reservation={selectedReservation}
          bookingPaymentMethodId={bookingPaymentMethodId}
          checkInTime={checkInTime}
        />
      ) : null}
    </>
  )
}

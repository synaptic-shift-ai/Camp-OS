'use client'

/**
 * Site Calendar Dialog
 *
 * Displays month view calendar with site reservations.
 * Shows reservation blocks color-coded by status.
 */

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Loader2, CalendarDays, User, DollarSign } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, isWithinInterval } from 'date-fns'
import type { Database } from '@/contracts/db'

type Site = Database['public']['Tables']['sites']['Row']
type Reservation = {
  id: string
  check_in_date: string
  check_out_date: string
  status?: string | null
  total_amount?: number
  guest?: { first_name?: string | null; last_name?: string | null } | null
}

interface SiteCalendarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: Site
}

const reservationStatusColors: Record<string, string> = {
  confirmed: 'bg-green-500 text-white',
  pending: 'bg-yellow-500 text-white',
  cancelled: 'bg-red-500 text-white',
  completed: 'bg-blue-500 text-white',
  checked_in: 'bg-orange-500 text-white',
}

export function SiteCalendarDialog({ open, onOpenChange, site }: SiteCalendarDialogProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open && site?.id) {
      fetchReservations()
    }
  }, [open, site?.id, currentMonth])

  const fetchReservations = async () => {
    setLoading(true)
    try {
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

      const siteId = site?.id
      if (!siteId) return
      const response = await fetch(
        `/api/admin/sites/${siteId}/reservations?start=${startDate}&end=${endDate}`
      )

      if (response.ok) {
        const data = await response.json()
        const list = (data.reservations || []).filter(
          (r: Reservation) => r.check_in_date && r.check_out_date
        )
        setReservations(list)
      } else {
        // If API endpoint doesn't exist yet, show empty state
        setReservations([])
      }
    } catch (error) {
      console.error('Error fetching reservations:', error)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get day of week for first day (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = monthStart.getDay()

  // Create array of days including leading empty cells
  const calendarDays = Array(firstDayOfWeek).fill(null).concat(daysInMonth)

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const getReservationsForDay = (day: Date) => {
    return reservations.filter((reservation) => {
      const checkInStr = reservation.check_in_date
      const checkOutStr = reservation.check_out_date
      if (!checkInStr || !checkOutStr) return false
      const checkIn = parseISO(checkInStr)
      const checkOut = parseISO(checkOutStr)
      return isWithinInterval(day, { start: checkIn, end: checkOut })
    })
  }

  const guestDisplayName = (r: Reservation) => {
    const g = r.guest
    if (!g) return 'Guest'
    const name = [g.first_name, g.last_name].filter(Boolean).join(' ').trim()
    return name || 'Guest'
  }

  const statusKey = (r: Reservation) => (r.status ?? 'pending').toLowerCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Calendar - Site {site.site_number}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            View reservations and availability for {site.site_name || `Site ${site.site_number}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base sm:text-lg font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 sm:py-64 text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Loading reservations...</span>
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="border rounded-lg p-1.5 sm:p-4">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-0.5 sm:gap-2 mb-0.5 sm:mb-2">
                  {[
                    { full: 'Sun', short: 'S' },
                    { full: 'Mon', short: 'M' },
                    { full: 'Tue', short: 'T' },
                    { full: 'Wed', short: 'W' },
                    { full: 'Thu', short: 'T' },
                    { full: 'Fri', short: 'F' },
                    { full: 'Sat', short: 'S' },
                  ].map(({ full, short }) => (
                    <div key={full} className="text-center font-semibold text-muted-foreground py-1">
                      <span className="hidden sm:inline text-sm">{full}</span>
                      <span className="inline sm:hidden text-xs">{short}</span>
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
                  {calendarDays.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="h-10 sm:h-24" />
                    }

                    const dayReservations = getReservationsForDay(day)
                    const isToday = isSameDay(day, new Date())
                    const hasReservations = dayReservations.length > 0

                    const cellContent = (
                      <div className="font-medium leading-none text-xs sm:text-sm mb-0.5 sm:mb-1">
                        {format(day, 'd')}
                      </div>
                    )

                    const reservationLabels = hasReservations && (
                      <div className="space-y-px sm:space-y-0.5">
                        {/* Mobile: dot indicators */}
                        <div className="flex flex-wrap gap-px sm:hidden">
                          {dayReservations.slice(0, 3).map((reservation) => (
                            <span
                              key={reservation.id}
                              className={`w-1.5 h-1.5 rounded-full ${reservationStatusColors[statusKey(reservation)]?.split(' ')[0] || 'bg-gray-500'}`}
                            />
                          ))}
                          {dayReservations.length > 3 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                          )}
                        </div>
                        {/* Desktop: text labels */}
                        <div className="hidden sm:block space-y-0.5">
                          {dayReservations.slice(0, 2).map((reservation) => (
                            <div
                              key={reservation.id}
                              className={`text-xs leading-tight px-1 py-0.5 rounded truncate ${reservationStatusColors[statusKey(reservation)] || 'bg-gray-500 text-white'
                                }`}
                            >
                              {guestDisplayName(reservation)}
                            </div>
                          ))}
                          {dayReservations.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayReservations.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    )

                    const cellClass = `
                      h-10 sm:h-24 border rounded p-1 sm:p-1.5 overflow-hidden
                      ${isToday ? 'border-primary border-2' : 'border-border'}
                      ${!isSameMonth(day, currentMonth) ? 'text-muted-foreground' : ''}
                      ${hasReservations ? 'bg-muted/50 cursor-pointer hover:bg-muted transition-colors' : ''}
                    `

                    if (!hasReservations) {
                      return (
                        <div key={day.toISOString()} className={cellClass}>
                          {cellContent}
                        </div>
                      )
                    }

                    return (
                      <Popover key={day.toISOString()}>
                        <PopoverTrigger asChild>
                          <div className={cellClass}>
                            {cellContent}
                            {reservationLabels}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[calc(100vw-2rem)] sm:w-80 p-0"
                          align="start"
                          side="bottom"
                          sideOffset={4}
                        >
                          <div className="p-3 border-b bg-muted/50">
                            <p className="font-semibold text-sm">{format(day, 'EEEE, MMMM d, yyyy')}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {dayReservations.length} reservation{dayReservations.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="divide-y max-h-64 overflow-y-auto">
                            {dayReservations.map((reservation) => (
                              <div key={reservation.id} className="p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-sm font-medium truncate">{guestDisplayName(reservation)}</span>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs border-transparent shrink-0 ${reservationStatusColors[statusKey(reservation)] || 'bg-gray-500 text-white'}`}
                                  >
                                    {reservation.status ?? 'pending'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    {format(parseISO(reservation.check_in_date), 'MMM d')} – {format(parseISO(reservation.check_out_date), 'MMM d, yyyy')}
                                  </span>
                                </div>
                                {reservation.total_amount != null && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                                    <span>${(reservation.total_amount / 100).toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                <span className="font-medium">Status:</span>
                <Badge variant="outline" className="border-transparent bg-green-500 text-white hover:bg-green-500">Confirmed</Badge>
                <Badge variant="outline" className="border-transparent bg-orange-500 text-white hover:bg-orange-500">Checked in</Badge>
                <Badge variant="outline" className="border-transparent bg-yellow-500 text-white hover:bg-yellow-500">Pending</Badge>
                <Badge variant="outline" className="border-transparent bg-blue-500 text-white hover:bg-blue-500">Completed</Badge>
                <Badge variant="outline" className="border-transparent bg-red-500 text-white hover:bg-red-500">Cancelled</Badge>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

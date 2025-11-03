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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, isWithinInterval } from 'date-fns'
import type { Database } from '@/src/contracts/db'

type Site = Database['public']['Tables']['sites']['Row']
type Reservation = {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  total_price: number
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
}

export function SiteCalendarDialog({ open, onOpenChange, site }: SiteCalendarDialogProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchReservations()
    }
  }, [open, currentMonth])

  const fetchReservations = async () => {
    setLoading(true)
    try {
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

      const response = await fetch(
        `/api/admin/sites/${site.id}/reservations?start=${startDate}&end=${endDate}`
      )

      if (response.ok) {
        const data = await response.json()
        setReservations(data.reservations || [])
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
      const checkIn = parseISO(reservation.check_in)
      const checkOut = parseISO(reservation.check_out)
      return isWithinInterval(day, { start: checkIn, end: checkOut })
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendar - Site {site.site_number}</DialogTitle>
          <DialogDescription>
            View reservations and availability for {site.site_name || `Site ${site.site_number}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="border rounded-lg p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />
                }

                const dayReservations = getReservationsForDay(day)
                const isToday = isSameDay(day, new Date())

                return (
                  <div
                    key={day.toISOString()}
                    className={`
                      aspect-square border rounded p-1 text-sm
                      ${isToday ? 'border-primary border-2' : 'border-border'}
                      ${!isSameMonth(day, currentMonth) ? 'text-muted-foreground' : ''}
                      ${dayReservations.length > 0 ? 'bg-muted/50' : ''}
                    `}
                  >
                    <div className="font-medium mb-1">{format(day, 'd')}</div>
                    {dayReservations.length > 0 && (
                      <div className="space-y-0.5">
                        {dayReservations.slice(0, 2).map((reservation) => (
                          <div
                            key={reservation.id}
                            className={`text-xs px-1 py-0.5 rounded truncate ${
                              reservationStatusColors[reservation.status] || 'bg-gray-500 text-white'
                            }`}
                            title={`${reservation.guest_name} - ${reservation.status}`}
                          >
                            {reservation.guest_name}
                          </div>
                        ))}
                        {dayReservations.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayReservations.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">Status:</span>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500">Confirmed</Badge>
              <Badge className="bg-yellow-500">Pending</Badge>
              <Badge className="bg-blue-500">Completed</Badge>
              <Badge className="bg-red-500">Cancelled</Badge>
            </div>
          </div>

          {loading && (
            <div className="text-center py-4 text-muted-foreground">
              Loading reservations...
            </div>
          )}

          {!loading && reservations.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              No reservations found for this month
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

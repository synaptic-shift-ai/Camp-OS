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
import type { Reservation } from '@/lib/booking/types'

interface TodaysArrivalsCardProps {
  arrivals: Array<
    Reservation & {
      guest?: { first_name: string; last_name: string; email: string }
      site?: { site_number: string; site_name: string | null }
    }
  >
}

export function TodaysArrivalsCard({ arrivals }: TodaysArrivalsCardProps) {
  const [selectedReservation, setSelectedReservation] = useState<
    (Reservation & {
      guest?: { first_name: string; last_name: string; email: string }
      site?: { site_number: string; site_name: string | null }
    }) | null
  >(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleCheckIn = (reservation: typeof arrivals[0]) => {
    setSelectedReservation(reservation)
    setDialogOpen(true)
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
            Today's Arrivals
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Arrivals
              </CardTitle>
              <CardDescription>
                {lateArrivals.length > 0 && (
                  <span className="text-red-600">{lateArrivals.length} late • </span>
                )}
                {todaysPendingCheckIns.length} today • {completedCheckIns.length} checked in
              </CardDescription>
            </div>
            <div className="flex gap-2">
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
        <CardContent>
          <div className="space-y-3">
            {/* Late Arrivals - Show first with red styling */}
            {lateArrivals.map((reservation) => {
              const outstandingBalance = reservation.total_amount - reservation.paid_amount
              const hasBalance = outstandingBalance > 0
              const checkInDate = new Date(reservation.check_in_date).toLocaleDateString()

              return (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <p className="font-medium truncate">
                        {reservation.guest?.first_name} {reservation.guest?.last_name}
                      </p>
                      <Badge variant="destructive" className="text-xs">
                        Late
                      </Badge>
                      {hasBalance && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200 text-yellow-700">
                          Balance Due
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        Site {reservation.site?.site_number}
                      </span>
                      <span className="text-red-600 text-xs">
                        Expected: {checkInDate}
                      </span>
                    </div>
                    {hasBalance && (
                      <p className="text-xs text-red-600 mt-1">
                        ${(outstandingBalance / 100).toFixed(2)} balance due
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleCheckIn(reservation)}
                    className="flex-shrink-0 ml-3"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Check In
                  </Button>
                </div>
              )
            })}

            {/* Today's Pending Check-ins */}
            {todaysPendingCheckIns.map((reservation) => {
              const outstandingBalance = reservation.total_amount - reservation.paid_amount
              const hasBalance = outstandingBalance > 0

              return (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-orange-600 flex-shrink-0" />
                      <p className="font-medium truncate">
                        {reservation.guest?.first_name} {reservation.guest?.last_name}
                      </p>
                      {hasBalance && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200 text-yellow-700">
                          Balance Due
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        Site {reservation.site?.site_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {reservation.num_adults + reservation.num_children} guests
                      </span>
                    </div>
                    {hasBalance && (
                      <p className="text-xs text-orange-600 mt-1">
                        ${(outstandingBalance / 100).toFixed(2)} balance due at check-in
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleCheckIn(reservation)}
                    className="flex-shrink-0 ml-3"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Check In
                  </Button>
                </div>
              )
            })}

            {/* Completed Check-ins */}
            {completedCheckIns.map((reservation) => (
              <div
                key={reservation.id}
                className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <p className="font-medium truncate">
                      {reservation.guest?.first_name} {reservation.guest?.last_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Home className="h-3 w-3" />
                      Site {reservation.site?.site_number}
                    </span>
                    {reservation.checked_in_at && (
                      <span className="text-green-600 text-xs" suppressHydrationWarning>
                        Checked in at {formatTime(reservation.checked_in_at)}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                  Checked In
                </Badge>
              </div>
            ))}

            {/* Show message if all check-ins complete */}
            {pendingCheckIns.length === 0 && completedCheckIns.length > 0 && (
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
        />
      )}
    </>
  )
}

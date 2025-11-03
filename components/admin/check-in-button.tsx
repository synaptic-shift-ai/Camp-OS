'use client'

/**
 * Check-in Button Component
 *
 * Renders a check-in action for reservations that are eligible for check-in.
 * Fetches full reservation data and opens CheckInDialog when clicked.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { CheckCircle, Loader2 } from 'lucide-react'
import { CheckInDialog } from '@/components/dashboard/reservations/check-in-dialog'
import { useToast } from '@/hooks/use-toast'
import type { Reservation } from '@/lib/booking/types'

interface CheckInButtonProps {
  reservationId: string
  status: string
  checkInDate: string
}

export function CheckInButton({ reservationId, status, checkInDate }: CheckInButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [reservationData, setReservationData] = useState<
    | (Reservation & {
        guest?: { first_name: string; last_name: string; email: string }
        site?: { site_number: string; site_name: string | null }
      })
    | null
  >(null)

  // Only show check-in for confirmed reservations with today's check-in date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkIn = new Date(checkInDate)
  checkIn.setHours(0, 0, 0, 0)

  const isEligible = status === 'confirmed' && checkIn.getTime() === today.getTime()

  if (!isEligible) {
    return null
  }

  const handleCheckInClick = async (e: Event) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Fetch full reservation data with guest and site info
      const response = await fetch(`/api/admin/reservations/${reservationId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch reservation details')
      }

      const data = await response.json()
      setReservationData(data.reservation)
      setDialogOpen(true)
    } catch (error) {
      console.error('Error fetching reservation:', error)
      toast({
        title: 'Error',
        description: 'Failed to load reservation details. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <DropdownMenuItem
        onSelect={handleCheckInClick}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
        Check In Guest
      </DropdownMenuItem>

      {reservationData && (
        <CheckInDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          reservation={reservationData}
        />
      )}
    </>
  )
}

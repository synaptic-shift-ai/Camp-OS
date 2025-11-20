'use client'

/**
 * Site Check-in Button Component
 *
 * Renders a check-in action for sites with active reservations checking in today.
 * Fetches reservation data for the site and opens CheckInDialog.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { CheckCircle, Loader2 } from 'lucide-react'
import { CheckInDialog } from '@/components/dashboard/reservations/check-in-dialog'
import { useToast } from '@/hooks/use-toast'
import type { Reservation } from '@/lib/booking/types'

interface SiteCheckInButtonProps {
  siteId: string
  siteStatus: string
}

export function SiteCheckInButton({ siteId, siteStatus }: SiteCheckInButtonProps) {
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

  // Only show check-in for booked sites (sites with confirmed reservations)
  if (siteStatus !== 'booked') {
    return null
  }

  const handleCheckInClick = async (e: Event) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Fetch today's reservation for this site
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(
        `/api/admin/sites/${siteId}/reservations?check_in_date=${today}&status=confirmed`
      )

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: 'No Check-in Today',
            description: 'No confirmed reservations checking in today for this site.',
            variant: 'default',
          })
          return
        }
        throw new Error('Failed to fetch reservation')
      }

      const data = await response.json()

      if (!data.reservation) {
        toast({
          title: 'No Check-in Today',
          description: 'No confirmed reservations checking in today for this site.',
          variant: 'default',
        })
        return
      }

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

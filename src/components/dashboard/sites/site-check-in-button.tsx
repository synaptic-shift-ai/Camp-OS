'use client'

/**
 * Site Check-in Button Component
 *
 * Renders a check-in action for booked sites with confirmed reservations.
 * Fetches reservation data for the site and opens CheckInDialog.
 */

import { useState } from 'react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { CheckCircle, Loader2 } from 'lucide-react'
import { CheckInDialog } from '@/components/dashboard/reservations/check-in-dialog'
import { useToast } from '@/hooks/use-toast'
import type { Reservation } from '@/lib/booking/types'

interface SiteCheckInButtonProps {
  siteId: string
  siteStatus: string
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function SiteCheckInButton({ siteId, siteStatus }: SiteCheckInButtonProps) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [reservationData, setReservationData] = useState<
    | (Reservation & {
        guest?: { first_name: string; last_name: string; email: string }
        site?: { site_number: string; site_name: string | null; status?: string | null }
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
      // Fetch confirmed reservation for this site
      const response = await fetch(
        `/api/admin/sites/${siteId}/reservations?status=confirmed`
      )

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: 'No Reservation',
            description: 'No confirmed reservations found for this site.',
            variant: 'default',
            className: SEASON_ALERT_TOAST_CLASS,
          })
          return
        }
        throw new Error('Failed to fetch reservation')
      }

      const data = await response.json()

      if (!data.reservation) {
        toast({
          title: 'No Reservation',
          description: 'No confirmed reservations found for this site.',
          variant: 'default',
          className: SEASON_ALERT_TOAST_CLASS,
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
        className: SEASON_ALERT_TOAST_CLASS,
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

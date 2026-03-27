'use client'

/**
 * Check-out Button Component
 *
 * Renders a check-out action for reservations that are currently checked in.
 * Fetches full reservation data and opens CheckOutDialog when clicked.
 */

import { useState } from 'react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { LogOut, Loader2 } from 'lucide-react'
import { CheckOutDialog } from '@/components/dashboard/reservations/check-out-dialog'
import { useToast } from '@/hooks/use-toast'
import type { Reservation } from '@/lib/booking/types'

interface CheckOutButtonProps {
  reservationId: string
  status: string
  allowedCheckOutDays?: string[] | undefined
  checkOutTime?: string | null | undefined
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function CheckOutButton({
  reservationId,
  status,
  allowedCheckOutDays,
  checkOutTime,
}: CheckOutButtonProps) {
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

  // Show check-out for checked_in reservations
  if (status !== 'checked_in') {
    return null
  }

  const handleCheckOutClick = async (e: Event) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Fetch full reservation data with guest and site info
      const response = await fetch(`/api/v1/reservations/${reservationId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch reservation details')
      }

      const data = await response.json()
      setReservationData(data.data)
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
        onSelect={handleCheckOutClick}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        Check Out Guest
      </DropdownMenuItem>

      {reservationData && (
        <CheckOutDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          reservation={reservationData}
          allowedCheckOutDays={allowedCheckOutDays}
          checkOutTime={checkOutTime}
        />
      )}
    </>
  )
}

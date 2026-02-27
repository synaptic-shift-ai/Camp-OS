'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2 } from 'lucide-react'
import { CheckOutDialog } from '@/components/dashboard/reservations/check-out-dialog'
import { useToast } from '@/hooks/use-toast'
import type { Reservation } from '@/lib/booking/types'

interface DepartureCheckOutButtonProps {
  reservationId: string
}

export function DepartureCheckOutButton({ reservationId }: DepartureCheckOutButtonProps) {
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

    const handleClick = async () => {
        setIsLoading(true)
        try {
        const response = await fetch(`/api/v1/reservations/${reservationId}`)
        const data = await response.json()
        setReservationData(data.data)
        setDialogOpen(true)
        } catch {
        toast({ title: 'Error', description: 'Failed to load reservation.', variant: 'destructive' })
        } finally {
        setIsLoading(false)
        }
    }

    return (
        <>
        <Button size="sm" variant="outline" onClick={handleClick} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
            Check Out
        </Button>
        {reservationData && (
            <CheckOutDialog open={dialogOpen} onOpenChange={setDialogOpen} reservation={reservationData} />
        )}
        </>
    )
}
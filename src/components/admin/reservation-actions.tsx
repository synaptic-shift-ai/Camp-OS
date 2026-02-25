"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical } from "lucide-react"
import { EditReservationDialog } from "./edit-reservation-dialog"
import { CancelReservationDialog } from "./cancel-reservation-dialog"
import { CheckInButton } from "./check-in-button"
import { CheckOutButton } from "./check-out-button"
import { ExtendDialog } from "./extend-dialog"
import { RenewDialog } from "./renew-dialog"

interface ReservationActionsProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  status: string
  checkIn: string
  checkOut: string
  numAdults: number
  numChildren: number
  numPets: number
  siteNumber: string
  siteName?: string | undefined
  pricePerNight: number
  bookingType?: 'seasonal' | 'monthly' | 'weekly' | 'nightly' | 'long_term' | undefined
}

export function ReservationActions({
  reservationId,
  confirmationNumber,
  guestName,
  status,
  checkIn,
  checkOut,
  numAdults,
  numChildren,
  numPets,
  siteNumber,
  siteName,
  pricePerNight,
  bookingType = 'nightly',
}: ReservationActionsProps) {
  // Only show extend/renew for confirmed or checked-in reservations
  const canExtendOrRenew = status === 'confirmed' || status === 'checked_in'

  const showCancel = status !== 'cancelled' && status !== 'checked_out' && status !== 'checked_in' && status !== 'no_show'

  // Renewals are primarily for seasonal/monthly bookings
  const showRenew = canExtendOrRenew && ['seasonal', 'monthly', 'long_term'].includes(bookingType)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <CheckInButton
          reservationId={reservationId}
          status={status}
        />
        <CheckOutButton
          reservationId={reservationId}
          status={status}
        />
        <EditReservationDialog
          reservationId={reservationId}
          confirmationNumber={confirmationNumber}
          guestName={guestName}
          checkIn={checkIn}
          checkOut={checkOut}
          numAdults={numAdults}
          numChildren={numChildren}
          numPets={numPets}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Edit Reservation
            </DropdownMenuItem>
          }
        />
        {canExtendOrRenew && (
          <>
            <DropdownMenuSeparator />
            <ExtendDialog
              reservationId={reservationId}
              confirmationNumber={confirmationNumber}
              guestName={guestName}
              currentCheckIn={checkIn}
              currentCheckOut={checkOut}
              siteNumber={siteNumber}
              siteName={siteName}
              pricePerNight={pricePerNight}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Extend Stay
                </DropdownMenuItem>
              }
            />
            {showRenew && (
              <RenewDialog
                reservationId={reservationId}
                confirmationNumber={confirmationNumber}
                guestName={guestName}
                currentCheckOut={checkOut}
                bookingType={bookingType}
                siteNumber={siteNumber}
                siteName={siteName}
                pricePerNight={pricePerNight}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    Renew Reservation
                  </DropdownMenuItem>
                }
              />
            )}
          </>
        )}
        {showCancel && (
          <>
            <DropdownMenuSeparator />
            <CancelReservationDialog
              reservationId={reservationId}
              confirmationNumber={confirmationNumber}
              guestName={guestName}
              trigger={
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={(e) => e.preventDefault()}
                >
                  Cancel Reservation
                </DropdownMenuItem>
              }
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

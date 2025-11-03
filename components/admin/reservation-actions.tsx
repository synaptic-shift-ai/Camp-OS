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

interface ReservationActionsProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  checkIn: string
  checkOut: string
  numAdults: number
  numChildren: number
  numPets: number
}

export function ReservationActions({
  reservationId,
  confirmationNumber,
  guestName,
  checkIn,
  checkOut,
  numAdults,
  numChildren,
  numPets,
}: ReservationActionsProps) {
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

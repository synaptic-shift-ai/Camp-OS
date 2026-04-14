'use client'

/**
 * Guest Actions Dropdown
 *
 * Client component that manages edit/delete/view-reservations dialog state per guest row.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { EditGuestDialog } from './edit-guest-dialog'
import { DeleteGuestDialog } from './delete-guest-dialog'
import { GuestReservationsSheet } from './guest-reservations-sheet'
import type { DashboardGuest } from '@/lib/dashboard/queries'

interface GuestActionsProps {
  guest: DashboardGuest
  propertyId: string
  onViewReservations?: (guest: DashboardGuest) => void
  canEditGuest: boolean
  canDeleteGuest: boolean
}

export function GuestActions({
  guest,
  propertyId,
  onViewReservations,
  canEditGuest,
  canDeleteGuest,
}: GuestActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reservationsOpen, setReservationsOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" onClick={(event) => event.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              if (onViewReservations) {
                onViewReservations(guest)
                return
              }
              setReservationsOpen(true)
            }}
          >
            View Reservations
          </DropdownMenuItem>
          {canEditGuest && (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              Edit Guest
            </DropdownMenuItem>
          )}
          {canDeleteGuest && <DropdownMenuSeparator />}
          {canDeleteGuest && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              Delete Guest
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!onViewReservations && (
        <GuestReservationsSheet
          open={reservationsOpen}
          onOpenChange={setReservationsOpen}
          guest={guest}
          propertyId={propertyId}
        />
      )}
      {canEditGuest && <EditGuestDialog open={editOpen} onOpenChange={setEditOpen} guest={guest} />}
      {canDeleteGuest && <DeleteGuestDialog open={deleteOpen} onOpenChange={setDeleteOpen} guest={guest} />}
    </>
  )
}

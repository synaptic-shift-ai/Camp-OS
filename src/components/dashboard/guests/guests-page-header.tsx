'use client'

/**
 * Guests Page Header
 *
 * Client header with title, description, and Add Guest button that opens AddGuestDialog.
 * Requires propertyId to enable adding guests.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AddGuestDialog } from './add-guest-dialog'

interface GuestsPageHeaderProps {
  propertyId: string | null
}

export function GuestsPageHeader({ propertyId }: GuestsPageHeaderProps) {
  const [addGuestOpen, setAddGuestOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Guests</h1>
          <p className="text-muted-foreground">Manage your guest database</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => setAddGuestOpen(true)}
          disabled={!propertyId}
        >
          <Plus className="h-4 w-4" />
          Add Guest
        </Button>
      </div>
      {propertyId && (
        <AddGuestDialog
          open={addGuestOpen}
          onOpenChange={setAddGuestOpen}
          propertyId={propertyId}
        />
      )}
    </>
  )
}

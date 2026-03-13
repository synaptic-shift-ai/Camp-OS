'use client'

/**
 * Guests Page Header
 *
 * Client header with title, description, Export menu, and Add Guest button.
 * Requires propertyId to enable adding guests.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AddGuestDialog } from './add-guest-dialog'
import { ExportMenu } from '@/components/ui/export-menu'
import { buildExportFilename, exportToCsv } from '@/lib/csv/export'
import type { DashboardGuest } from '@/lib/dashboard/queries'

interface GuestsPageHeaderProps {
  propertyId: string | null
  guests: DashboardGuest[]
  currentPage: number
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function GuestsPageHeader({ propertyId, guests, currentPage }: GuestsPageHeaderProps) {
  const [addGuestOpen, setAddGuestOpen] = useState(false)

  const handleExport = (format: string) => {
    if (format !== 'csv') return
    if (!guests.length) return

    const filename = buildExportFilename('GST')

    exportToCsv<DashboardGuest>(filename, guests, [
      { key: 'name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'totalStays', header: 'Total Stays' },
      {
        key: 'totalSpent',
        header: 'Total Spent',
        accessor: (guest) => formatMoney(guest.totalSpent),
      },
      {
        key: 'lastVisit',
        header: 'Last Visit',
        accessor: (guest) =>
          guest.lastVisit
            ? new Date(guest.lastVisit).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
            : 'N/A',
      },
    ])
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Guests</h1>
          <p className="text-muted-foreground">Manage your guest database</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            onExport={handleExport}
            disabled={!guests.length}
            aria-label="Export guests"
          />
          <Button
            className="gap-2"
            onClick={() => setAddGuestOpen(true)}
            disabled={!propertyId}
          >
            <Plus className="h-4 w-4" />
            Add Guest
          </Button>
        </div>
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

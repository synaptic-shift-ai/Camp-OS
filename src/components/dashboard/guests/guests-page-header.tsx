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
import { useToast } from '@/hooks/use-toast'

interface GuestsPageHeaderProps {
  propertyId: string | null
  guests: DashboardGuest[]
  currentPage: number
  total: number
  searchQuery: string | null
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function GuestsPageHeader({ propertyId, total, searchQuery }: GuestsPageHeaderProps) {
  const [addGuestOpen, setAddGuestOpen] = useState(false)
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = (format: string) => {
    if (format !== 'csv') return
    if (!propertyId) return
    if (!total || total <= 0) return
    if (isExporting) return

    void (async () => {
      try {
        setIsExporting(true)
        const filename = buildExportFilename('GST')

        const res = await fetch('/api/v1/exports/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId,
            filters:
              searchQuery && searchQuery.trim().length > 0
                ? { search: searchQuery }
                : {},
          }),
        })

        const json: any = await res.json()
        if (!res.ok || json?.success !== true) {
          throw new Error(json?.error?.message ?? 'Export failed')
        }

        const exportedGuests = json.data as DashboardGuest[]

        exportToCsv<DashboardGuest>(filename, exportedGuests, [
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

        toast({
          title: 'Export ready',
          description: 'Guests CSV has been downloaded.',
        })
      } catch (err) {
        toast({
          title: 'Export failed',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        })
      } finally {
        setIsExporting(false)
      }
    })()
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
            disabled={isExporting || total <= 0}
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

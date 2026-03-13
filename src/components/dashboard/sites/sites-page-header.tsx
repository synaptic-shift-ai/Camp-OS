'use client'

/**
 * Sites Page Header Component
 *
 * Client component for sites page header with actions.
 * Includes Import Sites, Add Site, and Export buttons.
 */

import { useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddSiteDialog } from './add-site-dialog'
import { BulkUploadDialog } from './bulk-upload-dialog'
import { ExportMenu } from '@/components/ui/export-menu'
import { buildExportFilename, exportToCsv } from '@/lib/csv/export'
import type { Database } from '@/contracts/db'

type Site = Database['public']['Tables']['sites']['Row']

interface SitesPageHeaderProps {
  propertyId: string | null
  sites: Site[]
}

export function SitesPageHeader({ propertyId, sites }: SitesPageHeaderProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  const handleExport = (format: string) => {
    if (format !== 'csv') return
    if (!sites.length) return

    const filename = buildExportFilename('ST')

    exportToCsv<Site>(filename, sites, [
      { key: 'site_number', header: 'Site Number' },
      { key: 'site_name', header: 'Site Name' },
      { key: 'site_type', header: 'Site Type' },
      { key: 'status', header: 'Status' },
      { key: 'max_occupancy', header: 'Max Occupancy' },
      { key: 'max_vehicles', header: 'Max Vehicles' },
    ])
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Sites</h1>
          <p className="text-muted-foreground">
            Manage your property sites and units
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            onExport={handleExport}
            disabled={!sites.length}
            aria-label="Export sites"
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsImportDialogOpen(true)}
            disabled={!propertyId}
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button
            className="gap-2"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={!propertyId}
          >
            <Plus className="h-4 w-4" />
            Add Site
          </Button>
        </div>
      </div>

      {/* Add Site Dialog */}
      {propertyId && (
        <AddSiteDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          propertyId={propertyId}
        />
      )}

      {/* Bulk Import Dialog */}
      {propertyId && (
        <BulkUploadDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          propertyId={propertyId}
        />
      )}
    </>
  )
}

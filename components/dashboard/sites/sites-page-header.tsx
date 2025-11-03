'use client'

/**
 * Sites Page Header Component
 *
 * Client component for sites page header with actions.
 * Includes Add Site and Import Sites buttons.
 */

import { useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BulkUploadDialog } from './bulk-upload-dialog'

interface SitesPageHeaderProps {
  propertyId: string | null
}

export function SitesPageHeader({ propertyId }: SitesPageHeaderProps) {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  const handleAddSite = () => {
    // TODO: Implement single site add
    // For now, could navigate to add site page or open add site dialog
    console.log('Add site clicked')
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
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsImportDialogOpen(true)}
            disabled={!propertyId}
          >
            <Upload className="h-4 w-4" />
            Import Sites
          </Button>
          <Button className="gap-2" onClick={handleAddSite}>
            <Plus className="h-4 w-4" />
            Add Site
          </Button>
        </div>
      </div>

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

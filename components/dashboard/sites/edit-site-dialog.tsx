'use client'

/**
 * Edit Site Dialog Component
 *
 * Dialog for editing an existing site using the SiteForm component.
 * Loads existing site data and calls PATCH API on save.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SiteForm } from '@/components/dashboard/setup-wizard/site-form'
import { useToast } from '@/hooks/use-toast'

interface EditSiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: any // Full site data from database
}

export function EditSiteDialog({ open, onOpenChange, site }: EditSiteDialogProps) {
  const router = useRouter()
  const { toast } = useToast()

  const handleSave = async (updatedSite: any) => {
    toast({
      title: 'Site Updated',
      description: `Site ${updatedSite.site_number} has been updated successfully`,
    })
    onOpenChange(false)
    router.refresh()
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Site {site.site_number}</DialogTitle>
          <DialogDescription>
            Update site information, pricing, and amenities
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <SiteForm
            propertyId={site.property_id}
            site={site}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

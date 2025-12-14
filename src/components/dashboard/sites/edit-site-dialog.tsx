'use client'

/**
 * Edit Site Dialog Component
 *
 * Dialog for editing an existing site using the SiteForm component.
 * Loads existing site data and calls PATCH API on save.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SiteForm, type PropertyDefaults } from '@/components/dashboard/setup-wizard/site-form'
import { useToast } from '@/hooks/use-toast'

interface EditSiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: any // Full site data from database
}

export function EditSiteDialog({ open, onOpenChange, site }: EditSiteDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [propertyDefaults, setPropertyDefaults] = useState<PropertyDefaults | undefined>(undefined)

  // Fetch property defaults for reservation types
  const fetchPropertyDefaults = useCallback(async () => {
    if (!site?.property_id) return

    try {
      const response = await fetch(`/api/v1/properties/${site.property_id}/reservation-types`)
      const result = await response.json()

      if (response.ok && result.success) {
        const config = result.data?.reservation_type_config
        const enabledTypes = result.data?.enabled_reservation_types

        setPropertyDefaults({
          enabled_reservation_types: enabledTypes,
          nightly_rate_cents: config?.nightly?.rate_cents ?? null,
          weekly_rate_cents: config?.weekly?.rate_cents ?? null,
          monthly_rate_cents: config?.monthly?.rate_cents ?? null,
          seasonal_rate_cents: config?.seasonal?.rate_cents ?? null,
        })
      }
    } catch (err) {
      console.error("Error fetching property defaults:", err)
    }
  }, [site?.property_id])

  useEffect(() => {
    if (open) {
      fetchPropertyDefaults()
    }
  }, [open, fetchPropertyDefaults])

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
            propertyDefaults={propertyDefaults}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

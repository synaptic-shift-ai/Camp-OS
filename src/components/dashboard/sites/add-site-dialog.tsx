'use client'

/**
 * Add Site Dialog Component
 *
 * Dialog wrapper for the site form to add individual sites.
 * Reuses the existing SiteForm component from the setup wizard.
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

interface AddSiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

export function AddSiteDialog({
  open,
  onOpenChange,
  propertyId,
}: AddSiteDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [propertyDefaults, setPropertyDefaults] = useState<PropertyDefaults | undefined>(undefined)

  // Fetch property defaults for reservation types
  const fetchPropertyDefaults = useCallback(async () => {
    if (!propertyId) return

    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/reservation-types`)
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
  }, [propertyId])

  useEffect(() => {
    if (open) {
      fetchPropertyDefaults()
    }
  }, [open, fetchPropertyDefaults])

  const handleSave = (site: any) => {
    toast({
      title: 'Site Created',
      description: `Site ${site.site_number} has been created successfully.`,
    })
    onOpenChange(false)
    router.refresh() // Refresh to show new site
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Site</DialogTitle>
          <DialogDescription>
            Create a new site for your property. All fields marked with * are
            required.
          </DialogDescription>
        </DialogHeader>

        <SiteForm
          propertyId={propertyId}
          propertyDefaults={propertyDefaults}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  )
}

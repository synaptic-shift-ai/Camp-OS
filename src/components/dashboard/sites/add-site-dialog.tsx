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
import { SiteForm, type PropertyDefaults, type SiteTypeConfig } from '@/components/dashboard/setup-wizard/site-form'
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
  const [siteTypeConfig, setSiteTypeConfig] = useState<SiteTypeConfig | undefined>(undefined)

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

  const fetchSiteTypeConfig = useCallback(async () => {
    if (!propertyId) return
    try {
      const res = await fetch(`/api/properties/${propertyId}/settings`)
      const json = await res.json()
      if (res.ok && json.success && json.property?.site_type_config) {
        setSiteTypeConfig(json.property.site_type_config as SiteTypeConfig)
      }
    } catch (e) {
      console.error("Error fetching site type config:", e)
    }
  }, [propertyId])

  useEffect(() => {
    if (open) {
      fetchPropertyDefaults()
      fetchSiteTypeConfig()
    }
  }, [open, fetchPropertyDefaults, fetchSiteTypeConfig])

  const handleSave = (site: any) => {
    toast({
      title: 'Site Created',
      description: `Site ${site.site_number} has been created successfully.`,
      variant: "success",
    })
    onOpenChange(false)
    router.refresh() // Refresh to show new site
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle>Add New Site</DialogTitle>
          <DialogDescription>
            Create a new site for your property. All fields marked with * are
            required.
          </DialogDescription>
        </DialogHeader>

        <SiteForm
          propertyId={propertyId}
          propertyDefaults={propertyDefaults}
          siteTypeConfig={siteTypeConfig}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  )
}

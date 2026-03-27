'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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

interface EditSiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: any
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function EditSiteDialog({ open, onOpenChange, site }: EditSiteDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [propertyDefaults, setPropertyDefaults] = useState<PropertyDefaults | undefined>(undefined)
  const [siteTypeConfig, setSiteTypeConfig] = useState<SiteTypeConfig | undefined>(undefined)

  // Track the latest site data locally so SiteForm always gets fresh data
  const [currentSite, setCurrentSite] = useState<any>(site)
  const justSavedRef = useRef(false)

  useEffect(() => {
    if (justSavedRef.current) {
      justSavedRef.current = false
      return
    }
    setCurrentSite(site)
  }, [site])

  useEffect(() => {
    if (open && !justSavedRef.current) {
      setCurrentSite(site)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

  const fetchSiteTypeConfig = useCallback(async () => {
    if (!site?.property_id) return
    try {
      const res = await fetch(`/api/properties/${site.property_id}/settings`)
      const json = await res.json()
      if (res.ok && json.success && json.property?.site_type_config) {
        setSiteTypeConfig(json.property.site_type_config as SiteTypeConfig)
      }
    } catch (e) {
      console.error("Error fetching site type config:", e)
    }
  }, [site?.property_id])

  useEffect(() => {
    if (open) {
      fetchPropertyDefaults()
      fetchSiteTypeConfig()
    }
  }, [open, fetchPropertyDefaults, fetchSiteTypeConfig])

  const handleSave = async (updatedSite: any) => {
    // Set flag BEFORE setCurrentSite so the prop-sync useEffect skips one cycle
    justSavedRef.current = true
    setCurrentSite(updatedSite)
    toast({
      title: 'Site Updated',
      description: `Site ${updatedSite.site_number} has been updated successfully`,
      className: SEASON_ALERT_TOAST_CLASS,
    })
    onOpenChange(false)
    router.refresh()
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle>Edit Site {currentSite?.site_number}</DialogTitle>
          <DialogDescription>
            Update site information, pricing, and amenities
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 sm:py-3">
          <SiteForm
            propertyId={currentSite?.property_id}
            site={currentSite}
            propertyDefaults={propertyDefaults}
            siteTypeConfig={siteTypeConfig}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
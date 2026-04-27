"use client"

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react"
import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tent, Plus, Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import { SiteForm, type PropertyDefaults, type SiteTypeConfig } from "./site-form"
import { ExistingSitesList } from "./existing-sites-list"
import { useToast } from "@/hooks/use-toast"

interface SitesSetupStepProps {
  property: Property
  onComplete: () => void
  onSkip: () => void
  /** Called with propertyId whenever this property is confirmed to have ≥1 site */
  onSiteConfirmed?: (propertyId: string) => void
}

export interface SitesSetupStepHandle {
  /**
   * Called by the wizard's Next button.
   * Waits for any in-progress fetch to finish, then:
   * Returns true  → has ≥1 site, wizard may advance.
   * Returns false → 0 sites, shows inline error, wizard stays.
   */
  canAdvance: () => Promise<boolean>
}

type ViewMode = "list" | "create" | "edit"

const SitesSetupStepComponent = (
  { property, onComplete, onSkip: _onSkip, onSiteConfirmed }: SitesSetupStepProps,
  ref: React.Ref<SitesSetupStepHandle>
) => {
  const [mode, setMode] = useState<ViewMode>("list")
  const [sites, setSites] = useState<any[]>([])
  const [editingSite, setEditingSite] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [_deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noSiteError, setNoSiteError] = useState<string | null>(null)
  const [propertyDefaults, setPropertyDefaults] = useState<PropertyDefaults | undefined>(undefined)
  const [siteTypeConfig, setSiteTypeConfig] = useState<SiteTypeConfig | undefined>(undefined)
  const loadingRef = useRef(true)
  const sitesRef = useRef<any[]>([])
  const { toast } = useToast()

  const fetchPropertyDefaults = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/properties/${property.id}/reservation-types`)
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
  }, [property.id])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${property.id}/settings`)
      const json = await res.json()
      if (res.ok && json.success && json.property?.site_type_config) {
        setSiteTypeConfig(json.property.site_type_config as SiteTypeConfig)
      }
    } catch (e) {
      console.error("Error fetching property settings:", e)
    }
  }, [property.id])

  const fetchSites = useCallback(async () => {
    try {
      setLoading(true)
      loadingRef.current = true
      const response = await fetch(`/api/v1/properties/${property.id}/sites`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to fetch sites")
      }

      const items = result.success && result.data?.items ? result.data.items : []
      setSites(items)
      sitesRef.current = items

      if (items.length > 0) {
        setNoSiteError(null)
        onSiteConfirmed?.(property.id)
      }
    } catch (err) {
      console.error("Error fetching sites:", err)
      setError(err instanceof Error ? err.message : "Failed to load sites")
      sitesRef.current = []
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [property.id, onSiteConfirmed])

  useEffect(() => {
    fetchSites()
    fetchPropertyDefaults()
    fetchSettings()
  }, [fetchSites, fetchPropertyDefaults, fetchSettings])


  useImperativeHandle(ref, () => ({
    canAdvance: (): Promise<boolean> => {
      return new Promise((resolve) => {
        const check = () => {
          if (loadingRef.current) {
            // Still fetching — poll every 100ms
            setTimeout(check, 100)
            return
          }
          if (sitesRef.current.length === 0) {
            setNoSiteError(
              `"${property.name}" has no sites yet. Please add at least one campsite before continuing.`
            )
            resolve(false)
          } else {
            setNoSiteError(null)
            resolve(true)
          }
        }
        check()
      })
    },
  }))

  const handleAddSiteClick = () => {
    setNoSiteError(null)
    setMode("create")
    setEditingSite(null)
  }

  const handleEditSite = (site: any) => {
    setEditingSite(site)
    setMode("edit")
  }

  const handleDeleteSite = async (siteId: string) => {
    try {
      setDeleting(true)
      const response = await fetch(`/api/v1/sites/${siteId}`, { method: "DELETE" })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to delete site")
      }

      toast({
        title: "Site deleted",
        description: "The site has been removed successfully.",
        variant: "success",
      })

      await fetchSites()
    } catch (err) {
      console.error("Error deleting site:", err)
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Failed to delete site",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleSiteSaved = async (savedSite: any) => {
    toast({
      title: mode === "edit" ? "Site updated" : "Site created",
      description: `Site ${savedSite.siteNumber} has been saved successfully.`,
      variant: "success",
    })

    await fetchSites()
    setMode("list")
    setEditingSite(null)
  }

  const handleCancel = () => {
    setMode("list")
    setEditingSite(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Tent className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Sites Setup</h2>
          <p className="text-muted-foreground">
            Add and configure campsites for {property.name}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {noSiteError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{noSiteError}</AlertDescription>
        </Alert>
      )}

      {/* List View */}
      {mode === "list" && (
        <>
          {sites.length === 0 ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/25 p-12 text-center">
              <Tent className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base font-semibold mb-2">No sites yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first campsite. You&apos;ll need at least one site to
                continue.
              </p>
              <Button onClick={handleAddSiteClick}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Site
              </Button>
            </div>
          ) : (
            <>
              <ExistingSitesList
                sites={sites}
                onEdit={handleEditSite}
                onDelete={handleDeleteSite}
              />

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Great! You&apos;ve added {sites.length} site{sites.length !== 1 ? "s" : ""}. You
                    can add more or continue to the next step.
                  </p>
                </div>
                <Button onClick={handleAddSiteClick} className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Site
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* Create / Edit Form */}
      {(mode === "create" || mode === "edit") && (
        <SiteForm
          propertyId={property.id}
          site={editingSite}
          propertyDefaults={propertyDefaults}
          siteTypeConfig={siteTypeConfig}
          onSave={handleSiteSaved}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}

export const SitesSetupStep = forwardRef(SitesSetupStepComponent)
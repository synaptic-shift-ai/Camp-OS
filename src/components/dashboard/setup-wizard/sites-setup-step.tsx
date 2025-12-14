"use client"

import { useState, useEffect, useCallback } from "react"
import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tent, Plus, Loader2, CheckCircle } from "lucide-react"
import { SiteForm } from "./site-form"
import { ExistingSitesList } from "./existing-sites-list"
import { useToast } from "@/hooks/use-toast"

interface SitesSetupStepProps {
  property: Property
  onComplete: () => void
  onSkip: () => void
}

type ViewMode = "list" | "create" | "edit"

export function SitesSetupStep({ property, onComplete, onSkip }: SitesSetupStepProps) {
  const [mode, setMode] = useState<ViewMode>("list")
  const [sites, setSites] = useState<any[]>([])
  const [editingSite, setEditingSite] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Fetch existing sites - migrated to v1 API
  const fetchSites = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/properties/${property.id}/sites`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to fetch sites")
      }

      // v1 API returns { success: true, data: { items: [...] } }
      const items = result.success && result.data?.items ? result.data.items : []
      setSites(items)
    } catch (err) {
      console.error("Error fetching sites:", err)
      setError(err instanceof Error ? err.message : "Failed to load sites")
    } finally {
      setLoading(false)
    }
  }, [property.id])

  useEffect(() => {
    fetchSites()
  }, [fetchSites])

  const handleAddSiteClick = () => {
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
      // Migrated to v1 API
      const response = await fetch(`/api/v1/sites/${siteId}`, {
        method: "DELETE",
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to delete site")
      }

      toast({
        title: "Site deleted",
        description: "The site has been removed successfully.",
      })

      // Refresh sites list
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
    })

    // Refresh sites list
    await fetchSites()

    // Return to list view
    setMode("list")
    setEditingSite(null)
  }

  const handleCancel = () => {
    setMode("list")
    setEditingSite(null)
  }

  const handleContinue = () => {
    if (sites.length === 0) {
      setError("Please add at least one site before continuing")
      return
    }
    onComplete()
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
          <h2 className="text-2xl font-bold">Sites Setup</h2>
          <p className="text-muted-foreground">
            Add and configure campsites for {property.name}
          </p>
        </div>
        {mode === "list" && (
          <Button onClick={handleAddSiteClick}>
            <Plus className="mr-2 h-4 w-4" />
            Add Site
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* List View */}
      {mode === "list" && (
        <>
          {sites.length === 0 ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/25 p-12 text-center">
              <Tent className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sites yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first campsite. You'll need at least one site to
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

              {/* Success message */}
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Great! You've added {sites.length} site{sites.length !== 1 ? "s" : ""}. You
                  can add more or continue to the next step.
                </AlertDescription>
              </Alert>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={handleContinue}>
                  Continue to Dashboard Tour
                </Button>
                <Button variant="outline" onClick={handleAddSiteClick}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Site
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* Create/Edit Form View */}
      {(mode === "create" || mode === "edit") && (
        <SiteForm
          propertyId={property.id}
          site={editingSite}
          onSave={handleSiteSaved}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}

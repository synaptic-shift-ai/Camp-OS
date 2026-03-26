'use client'

/**
 * Site Details Dialog
 *
 * Displays comprehensive site information in a read-only view.
 * Includes Edit button to open EditSiteDialog.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit } from 'lucide-react'
import { EditSiteDialog } from './edit-site-dialog'
import type { Database } from '@/contracts/db'

type Site = Database['public']['Tables']['sites']['Row']
type SiteStatus = 'available' | 'reserved' | 'booked' | 'occupied' | 'housekeeping' | 'maintenance' | 'unavailable'

interface SiteDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: Site
}

const statusColors: Record<SiteStatus, string> = {
  available: "bg-green-500/10 text-green-500 border-green-500/20",
  reserved: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  booked: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  occupied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  housekeeping: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  unavailable: "bg-red-500/10 text-red-500 border-red-500/20",
}

const siteTypeLabels: Record<string, string> = {
  rv: 'RV Site',
  tent: 'Tent Site',
  cabin: 'Cabin',
  glamping: 'Glamping',
  yurt: 'Yurt',
  other: 'Other',
}

export function SiteDetailsDialog({ open, onOpenChange, site }: SiteDetailsDialogProps) {
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [propertyAmenities, setPropertyAmenities] = useState<Array<{ id: string; name: string }> | null>(null)

  useEffect(() => {
    if (!open) return
    const propertyId =
      ((site as any).property_id as string | undefined) ??
      ((site as any).propertyId as string | undefined)
    if (!propertyId) return

    let cancelled = false

    const fetchAmenities = async () => {
      try {
        const response = await fetch(`/api/v1/properties/${propertyId}`, {
          credentials: "include",
        })
        const result = await response.json()
        if (cancelled) return

        if (response.ok && result.success) {
          const dbAmenities = result.data?.amenities
          setPropertyAmenities(Array.isArray(dbAmenities) ? dbAmenities : [])
        } else {
          setPropertyAmenities([])
        }
      } catch {
        if (cancelled) return
        setPropertyAmenities([])
      }
    }

    setPropertyAmenities(null) // show raw ids until we resolve
    fetchAmenities()

    return () => {
      cancelled = true
    }
  }, [open, (site as any).property_id, (site as any).propertyId])

  const displayAmenities = useMemo(() => {
    const amenityIds = Array.isArray(site.amenities) ? (site.amenities as string[]) : []
    if (propertyAmenities === null) return null

    // Normalize to avoid UUID case mismatches (UUIDs are case-insensitive, strings are not).
    const byId = new Map(propertyAmenities.map((a) => [a.id.toLowerCase(), a.name]))
    return amenityIds.map((amenityId) => {
      const normalized = typeof amenityId === 'string' ? amenityId.toLowerCase() : String(amenityId).toLowerCase()
      return byId.get(normalized) ?? 'Unknown amenity'
    })
  }, [propertyAmenities, site.amenities])

  const formatPrice = (cents: number | null) => {
    if (!cents) return 'Not set'
    return `$${(cents / 100).toFixed(2)}`
  }

  const status = (site.status || 'unavailable') as SiteStatus
  const siteType = site.site_type || 'other'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">Site {site.site_number}</DialogTitle>
                <DialogDescription>
                  {siteTypeLabels[siteType]} • {site.site_name || 'Unnamed Site'}
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditDialog(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Status Section */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Status</h3>
              <Badge className={statusColors[status]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            </div>

            {/* Basic Info Section */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Site Number</span>
                  <p className="font-medium">{site.site_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium capitalize">{siteTypeLabels[siteType]}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Occupancy</span>
                  <p className="font-medium">{site.max_occupancy || 'Not set'}</p>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Pricing</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Base Price (per night)</span>
                  <p className="font-medium">{formatPrice(site.base_price)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Weekend Price</span>
                  <p className="font-medium">{formatPrice(site.weekend_price)}</p>
                </div>
              </div>
            </div>

            {/* Hookups Section */}
            {site.hookups && Array.isArray(site.hookups) && site.hookups.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Hookups</h3>
                <div className="flex flex-wrap gap-2">
                  {(site.hookups as string[]).map((hookup) => (
                    <Badge key={hookup} variant="secondary">
                      {hookup}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities Section */}
            {displayAmenities === null ? (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Amenities</h3>
                <div className="text-sm text-muted-foreground">Loading amenities...</div>
              </div>
            ) : displayAmenities.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {displayAmenities.map((amenityLabel, idx) => {
                    const rawId = Array.isArray(site.amenities) ? (site.amenities as string[])[idx] : amenityLabel
                    return (
                      <Badge key={`${rawId}-${idx}`} variant="outline">
                        {amenityLabel}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* Description Section */}
            {site.description && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{site.description}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {showEditDialog && (
        <EditSiteDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open)
            if (!open) {
              // Close details dialog when edit is saved
              onOpenChange(false)
            }
          }}
          site={site}
        />
      )}
    </>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Edit, Trash2, DollarSign, Users, Car } from "lucide-react"

interface Site {
  id: string
  siteNumber: string
  siteName: string | null
  siteType: string
  status: string
  pricing: {
    basePrice: number // in cents
    weekendPrice: number // in cents
  }
  capacity: {
    maxOccupancy: number | null
    maxVehicles: number | null
  }
  hookups: string[] | null
  amenities: string[] | null
}

interface ExistingSitesListProps {
  sites: Site[]
  onEdit: (site: Site) => void
  onDelete: (siteId: string) => void
}

export function ExistingSitesList({ sites, onEdit, onDelete }: ExistingSitesListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null)

  const handleDeleteClick = (site: Site) => {
    setSiteToDelete(site)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (siteToDelete) {
      onDelete(siteToDelete.id)
      setDeleteDialogOpen(false)
      setSiteToDelete(null)
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const getSiteTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      tent: "bg-green-100 text-green-800",
      rv: "bg-blue-100 text-blue-800",
      cabin: "bg-amber-100 text-amber-800",
      glamping: "bg-purple-100 text-purple-800",
      yurt: "bg-pink-100 text-pink-800",
      other: "bg-gray-100 text-gray-800",
    }
    return colors[type] || colors.other
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: "bg-green-100 text-green-800",
      unavailable: "bg-red-100 text-red-800",
      maintenance: "bg-yellow-100 text-yellow-800",
    }
    return colors[status] || colors.available
  }

  if (sites.length === 0) {
    return null
  }

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Existing Sites ({sites.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => (
            <Card key={site.id}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-lg">Site {site.siteNumber}</h4>
                      <Badge className={getSiteTypeColor(site.siteType)}>
                        {site.siteType}
                      </Badge>
                    </div>
                    {site.siteName && (
                      <p className="text-sm text-muted-foreground">{site.siteName}</p>
                    )}
                  </div>
                  <Badge className={getStatusColor(site.status)} variant="outline">
                    {site.status}
                  </Badge>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatPrice(site.pricing.basePrice)}/night</span>
                    {site.pricing.weekendPrice > 0 && site.pricing.weekendPrice !== site.pricing.basePrice && (
                      <span className="text-muted-foreground">
                        ({formatPrice(site.pricing.weekendPrice)} weekends)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Up to {site.capacity.maxOccupancy ?? 0} guests</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span>{site.capacity.maxVehicles ?? 0} vehicle{(site.capacity.maxVehicles ?? 0) !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Hookups */}
                  {site.hookups && site.hookups.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {site.hookups.map((hookup) => (
                        <Badge key={hookup} variant="secondary" className="text-xs">
                          {hookup}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Amenities */}
                  {site.amenities && site.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {site.amenities.slice(0, 3).map((amenity) => (
                        <Badge key={amenity} variant="outline" className="text-xs">
                          {amenity.replace(/_/g, " ")}
                        </Badge>
                      ))}
                      {site.amenities.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{site.amenities.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(site)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteClick(site)}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Site {siteToDelete?.siteNumber}
              {siteToDelete?.siteName ? ` (${siteToDelete.siteName})` : ""}? This action
              cannot be undone.
              {siteToDelete && (
                <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                  <strong>Note:</strong> Sites with active or future reservations cannot be
                  deleted.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Site
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

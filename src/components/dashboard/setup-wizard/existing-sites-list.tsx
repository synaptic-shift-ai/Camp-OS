"use client"

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { MoreVertical, Edit, Trash2, Tent, Home, TreePine, Sparkles, Circle, MapPin } from "lucide-react"
import type { SiteType } from "@/lib/booking/types"

const siteTypeIcons: Record<SiteType, LucideIcon> = {
  rv: Home,
  tent: Tent,
  cabin: TreePine,
  glamping: Sparkles,
  yurt: Circle,
  other: MapPin,
}

type SiteStatus = "available" | "reserved" | "booked" | "occupied" | "housekeeping" | "maintenance" | "unavailable"

const statusColors: Record<SiteStatus, string> = {
  available: "bg-green-500/10 text-green-500 border-green-500/20",
  reserved: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  booked: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  occupied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  housekeeping: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  unavailable: "bg-red-500/10 text-red-500 border-red-500/20",
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

interface Site {
  id: string
  siteNumber: string
  siteName: string | null
  siteType: string
  status: string
  pricing: {
    basePrice: number
    weekendPrice: number
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

  const handleDeleteClick = (site: Site, e: React.MouseEvent) => {
    e.stopPropagation()
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

  if (sites.length === 0) {
    return null
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => {
          const Icon = siteTypeIcons[site.siteType as SiteType] || MapPin
          const statusClass = statusColors[site.status as SiteStatus] || statusColors.unavailable

          return (
            <Card key={site.id} className="relative overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Site {site.siteNumber}</CardTitle>
                      <CardDescription className="text-sm">
                        {site.siteName || `Site ${site.siteNumber}`}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(site)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Site
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleDeleteClick(site, e)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Site
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={statusClass}>
                    {site.status}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {site.siteType}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Occupancy</span>
                    <span className="font-medium">{site.capacity.maxOccupancy ?? 0} guests</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Price</span>
                    <span className="font-medium">{formatMoney(site.pricing.basePrice)}/night</span>
                  </div>
                  {site.pricing.weekendPrice > 0 && site.pricing.weekendPrice !== site.pricing.basePrice && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Weekend</span>
                      <span className="font-medium">{formatMoney(site.pricing.weekendPrice)}/night</span>
                    </div>
                  )}
                  {site.hookups && site.hookups.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Hookups</span>
                      <span className="font-medium capitalize text-right">{site.hookups.join(", ")}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Site {siteToDelete?.siteNumber}
              {siteToDelete?.siteName ? ` (${siteToDelete.siteName})` : ""}? This action cannot be
              undone.
              {siteToDelete && (
                <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                  <strong>Note:</strong> Sites with active or future reservations cannot be deleted.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Site
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

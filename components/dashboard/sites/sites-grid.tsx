'use client'

/**
 * Sites Grid Client Component
 *
 * Interactive grid of site cards with action menus.
 * Handles Edit, Delete, and Calendar actions.
 */

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MoreVertical, Tent, Home, TreePine, Sparkles, Circle, MapPin, Edit, Calendar, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditSiteDialog } from './edit-site-dialog'
import { DeleteSiteDialog } from './delete-site-dialog'
import type { SiteType } from '@/lib/booking/types'
import type { Database } from '@/src/contracts/db'

const siteTypeIcons: Record<SiteType, LucideIcon> = {
  rv: Home,
  tent: Tent,
  cabin: TreePine,
  glamping: Sparkles,
  yurt: Circle,
  other: MapPin,
}

type SiteStatus = 'available' | 'occupied' | 'maintenance' | 'housekeeping' | 'unavailable'

const statusColors: Record<SiteStatus, string> = {
  available: "bg-green-500/10 text-green-500 border-green-500/20",
  occupied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  housekeeping: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  unavailable: "bg-red-500/10 text-red-500 border-red-500/20",
}

type Site = Database['public']['Tables']['sites']['Row']

interface SitesGridProps {
  sites: Site[]
}

/**
 * Format money from integer cents to dollar display
 */
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function SitesGrid({ sites }: SitesGridProps) {
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [deletingSite, setDeletingSite] = useState<Site | null>(null)

  const handleEditClick = (site: Site, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSite(site)
  }

  const handleDeleteClick = (site: Site, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingSite(site)
  }

  const handleCalendarClick = (site: Site, e: React.MouseEvent) => {
    e.stopPropagation()
    // TODO: Implement calendar dialog in Phase 2
    console.log('View calendar for site:', site.site_number)
  }

  if (sites.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No sites yet. Add your first site!</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => {
          const Icon = siteTypeIcons[site.site_type as SiteType] || MapPin
          return (
            <Card key={site.id} className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Site {site.site_number}</CardTitle>
                      <CardDescription className="text-sm">
                        {site.site_name || `Site ${site.site_number}`}
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
                      <DropdownMenuItem onClick={(e) => handleEditClick(site, e)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Site
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleCalendarClick(site, e)}>
                        <Calendar className="mr-2 h-4 w-4" />
                        View Calendar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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
                  <Badge variant="outline" className={statusColors[site.status as SiteStatus]}>
                    {site.status}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {site.site_type}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Occupancy</span>
                    <span className="font-medium">{site.max_occupancy} guests</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Price</span>
                    <span className="font-medium">{formatMoney(site.base_price)}/night</span>
                  </div>
                  {site.hookups && Array.isArray(site.hookups) && site.hookups.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hookups</span>
                      <span className="font-medium capitalize">{site.hookups.join(', ')}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Edit Dialog */}
      {editingSite && (
        <EditSiteDialog
          open={!!editingSite}
          onOpenChange={(open) => !open && setEditingSite(null)}
          site={editingSite}
        />
      )}

      {/* Delete Dialog */}
      {deletingSite && (
        <DeleteSiteDialog
          open={!!deletingSite}
          onOpenChange={(open) => !open && setDeletingSite(null)}
          site={{
            id: deletingSite.id,
            site_number: deletingSite.site_number,
            ...(deletingSite.site_name && { site_name: deletingSite.site_name }),
          }}
        />
      )}
    </>
  )
}

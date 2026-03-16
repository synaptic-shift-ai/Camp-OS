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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { EditSiteDialog } from './edit-site-dialog'
import { DeleteSiteDialog } from './delete-site-dialog'
import { SiteDetailsDialog } from './site-details-dialog'
import { SiteCalendarDialog } from './site-calendar-dialog'
import { SiteCheckInButton } from './site-check-in-button'
import { HousekeepingScheduleDialog } from './housekeeping-schedule-dialog'
import type { SiteType } from '@/lib/booking/types'
import type { Database } from '@/contracts/db'
import type { PropertyPricingConfig } from '@/app/dashboard/[propertyId]/sites/page'
import { getPricingSourceType, getManualOverrideTypes } from '@/lib/site-pricing-source'

const siteTypeIcons: Record<SiteType, LucideIcon> = {
  rv: Home,
  tent: Tent,
  cabin: TreePine,
  glamping: Sparkles,
  yurt: Circle,
  other: MapPin,
}

type SiteStatus = 'available' | 'reserved' | 'booked' | 'occupied' | 'housekeeping' | 'maintenance' | 'unavailable'

const statusColors: Record<SiteStatus, string> = {
  available: "bg-green-500/10 text-green-500 border-green-500/20",
  reserved: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  booked: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  occupied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  housekeeping: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  unavailable: "bg-red-500/10 text-red-500 border-red-500/20",
}

type Site = Database['public']['Tables']['sites']['Row']

interface SitesGridProps {
  sites: Site[]
  propertyPricingConfig?: PropertyPricingConfig | undefined
}

/**
 * Rate display info for a single reservation type
 */
type RateDisplay = {
  type: 'nightly' | 'weekly' | 'monthly' | 'seasonal'
  label: string
  rateCents: number
  isOverride: boolean
}

/**
 * Get the rates to display for a site based on pricing source:
 * - property_default: from reservation_type_config (config.rates)
 * - site_type_default: from site_type_config.site_type_rates[site.site_type]
 * - manual: from site's base_price, weekly_rate_cents, etc.
 */
function getDisplayRates(site: Site, config?: PropertyPricingConfig): RateDisplay[] {
  if (!config) return []

  const rates: RateDisplay[] = []
  const rawOverride = site.enabled_reservation_types_override
  const sourceType = getPricingSourceType(rawOverride)
  const manualTypes = getManualOverrideTypes(rawOverride)
  const usesManual = sourceType === 'manual'
  const usesSiteTypeDefault = sourceType === 'site_type_default'

  const typesToShow =
    usesManual && manualTypes?.length
      ? manualTypes
      : config.rates.filter((r) => r.enabled).map((r) => r.type)

  // Resolve site-type rates when source is site_type_default (case-insensitive key)
  const siteTypeRates = usesSiteTypeDefault
    ? (() => {
        const st = (site.site_type ?? '').toLowerCase()
        const map = config.siteTypeConfig?.site_type_rates ?? {}
        const key = Object.keys(map).find((k) => k.toLowerCase() === st) ?? (site.site_type ?? '')
        return key ? map[key] : null
      })()
    : null

  for (const typeConfig of config.rates) {
    if (!typesToShow.includes(typeConfig.type)) continue

    let rateCents = typeConfig.rateCents ?? 0
    let isOverride = false

    if (usesSiteTypeDefault && siteTypeRates) {
      const typeRate = siteTypeRates[typeConfig.type]?.rate_cents
      if (typeRate != null && typeRate > 0) {
        rateCents = typeRate
      }
    } else if (usesManual) {
      switch (typeConfig.type) {
        case 'nightly':
          if (site.base_price > 0) {
            rateCents = site.base_price
            isOverride = typeConfig.rateCents != null && site.base_price !== typeConfig.rateCents
          }
          break
        case 'weekly':
          if (site.weekly_rate_cents != null) {
            rateCents = site.weekly_rate_cents
            isOverride = typeConfig.rateCents != null && site.weekly_rate_cents !== typeConfig.rateCents
          }
          break
        case 'monthly':
          if (site.monthly_rate_cents != null) {
            rateCents = site.monthly_rate_cents
            isOverride = typeConfig.rateCents != null && site.monthly_rate_cents !== typeConfig.rateCents
          }
          break
        case 'seasonal':
          if (site.seasonal_rate_cents != null) {
            rateCents = site.seasonal_rate_cents
            isOverride = typeConfig.rateCents != null && site.seasonal_rate_cents !== typeConfig.rateCents
          }
          break
      }
    }
    // else: property_default → rateCents already from typeConfig.rateCents

    if (rateCents > 0) {
      rates.push({
        type: typeConfig.type,
        label: typeConfig.label,
        rateCents,
        isOverride,
      })
    }
  }

  return rates
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

export function SitesGrid({ sites, propertyPricingConfig }: SitesGridProps) {
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [deletingSite, setDeletingSite] = useState<Site | null>(null)
  const [viewingSite, setViewingSite] = useState<Site | null>(null)
  const [calendarSite, setCalendarSite] = useState<Site | null>(null)
  const [statusPopoverOpen, setStatusPopoverOpen] = useState<string | null>(null)
  const [schedulingSite, setSchedulingSite] = useState<{ site: Site; status: 'housekeeping' | 'maintenance' } | null>(null)
  const { toast } = useToast()
  const router = useRouter()

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
    setCalendarSite(site)
  }

  const handleStatusChange = async (site: Site, newStatus: SiteStatus, e: React.MouseEvent) => {
    e.stopPropagation()

    if (newStatus === 'housekeeping' || newStatus === 'maintenance') {
      setStatusPopoverOpen(null)
      setSchedulingSite({ site, status: newStatus })
      return
    }

    try {
      // Migrated to v1 API
      const response = await fetch(`/api/v1/sites/${site.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update status')
      }

      toast({
        title: 'Status Updated',
        description: `Site ${site.site_number} is now ${newStatus}`,
      })

      setStatusPopoverOpen(null)
      router.refresh()
    } catch (err) {
      console.error('Error updating status:', err)
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update status',
        variant: 'destructive',
      })
    }
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
          const displayRates = getDisplayRates(site, propertyPricingConfig)
          const hasAnyOverride = displayRates.some((r) => r.isOverride)
          const sourceType = getPricingSourceType(site.enabled_reservation_types_override)
          const usesPropertyDefaults = sourceType === 'property_default'
          const usesSiteTypeDefaults = sourceType === 'site_type_default'
          const usesManualPricing = sourceType === 'manual'

          return (
            <Card
              key={site.id}
              className={`relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${usesManualPricing ? 'border-l-2 border-l-amber-500/60' : ''}`}
              onClick={() => setViewingSite(site)}
            >
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
                      <SiteCheckInButton siteId={site.id} siteStatus={site.status || 'unavailable'} />
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
                  <Popover
                    open={statusPopoverOpen === site.id}
                    onOpenChange={(open) => setStatusPopoverOpen(open ? site.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <Badge
                        variant="outline"
                        className={`${statusColors[site.status as SiteStatus]} cursor-pointer hover:scale-105 transition-transform`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {site.status}
                      </Badge>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
                          Change Status
                        </p>
                        {(['available', 'reserved', 'booked', 'occupied', 'housekeeping', 'maintenance', 'unavailable'] as SiteStatus[]).map((status) => (
                          <Button
                            key={status}
                            variant="ghost"
                            size="sm"
                            className={`w-full justify-start ${statusColors[status]}`}
                            onClick={(e) => handleStatusChange(site, status, e)}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Badge variant="outline" className="capitalize">
                    {site.site_type}
                  </Badge>
                </div>
                {(site as any).availability_rules?.blocked_dates?.length > 0 && (
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={`text-xs w-full justify-center ${(site as any).availability_rules.blocked_dates[0].reason === 'maintenance'
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-orange-50 border-orange-200 text-orange-700'
                        }`}
                    >
                      🗓 {(site as any).availability_rules.blocked_dates[0].reason === 'maintenance' ? 'Scheduled Maintenance' : 'Scheduled Housekeeping'}: {(site as any).availability_rules.blocked_dates[0].from}
                      {(site as any).availability_rules.blocked_dates[0].from !== (site as any).availability_rules.blocked_dates[0].to
                        ? ` – ${(site as any).availability_rules.blocked_dates[0].to}`
                        : ''}
                    </Badge>
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Occupancy</span>
                    <span className="font-medium">{site.max_occupancy} guests</span>
                  </div>

                  {/* Show all enabled rate types */}
                  {displayRates.length > 0 ? (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Rates</span>
                        {usesPropertyDefaults && (
                          <span className="text-xs text-muted-foreground/70 italic">Property defaults</span>
                        )}
                        {usesSiteTypeDefaults && (
                          <span className="text-xs text-muted-foreground/70 italic">Site type defaults</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {displayRates.map((rate) => (
                          <div key={rate.type} className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">{rate.label}</span>
                            <div className="text-right">
                              <span className="font-medium text-sm">
                                {formatMoney(rate.rateCents)}
                                {rate.type === 'seasonal' ? '' : `/${rate.type === 'nightly' ? 'night' : rate.type === 'weekly' ? 'wk' : 'mo'}`}
                              </span>
                              {rate.isOverride && (
                                <span className="ml-1 text-xs text-amber-600">*</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {usesManualPricing && (
                        <p className="text-xs text-amber-600/80 mt-1">
                          {hasAnyOverride ? '* Custom rate override' : 'Custom pricing enabled'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Price</span>
                      <span className="font-medium">{formatMoney(site.base_price ?? 0)}/night</span>
                    </div>
                  )}

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

      {/* Details Dialog */}
      {viewingSite && (
        <SiteDetailsDialog
          open={!!viewingSite}
          onOpenChange={(open) => !open && setViewingSite(null)}
          site={viewingSite}
        />
      )}

      {/* Calendar Dialog */}
      {calendarSite && (
        <SiteCalendarDialog
          open={!!calendarSite}
          onOpenChange={(open) => !open && setCalendarSite(null)}
          site={calendarSite}
        />
      )}

      {/* Housekeeping / Maintenance Schedule Dialog */}
      {schedulingSite && (
        <HousekeepingScheduleDialog
          open={!!schedulingSite}
          onOpenChange={(open) => !open && setSchedulingSite(null)}
          site={{
            ...schedulingSite.site,
            availability_rules: schedulingSite.site.availability_rules as { blocked_dates?: Array<{ from: string; to: string; reason: string }> } | null,
          }}
          status={schedulingSite.status}
        />
      )}
    </>
  )
}

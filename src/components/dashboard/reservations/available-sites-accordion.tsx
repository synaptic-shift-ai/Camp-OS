'use client'

/**
 * Available Sites Accordion Component
 *
 * Groups available sites by type in collapsible accordion sections for manual reservation flow.
 * Shows selected site summary in accordion header.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Zap,
  Droplet,
  Wifi,
  Flame,
  PawPrint,
  Tent,
  Home,
  Caravan,
} from 'lucide-react'

type BookingType = 'nightly' | 'weekly' | 'monthly' | 'seasonal' | 'long_term'

interface AvailableSite {
  id: string
  name: string
  site_number: string
  site_type: string
  max_occupancy: number
  base_price_per_night: number
  weekly_rate_cents?: number
  monthly_rate_cents?: number
  amenities: Record<string, boolean>
  image_url?: string
}

interface AvailableSitesAccordionProps {
  sites: AvailableSite[]
  selectedSiteId: string | null
  onSiteSelect: (siteId: string) => void
  stayType?: BookingType
  /** Optional: when provided, accordion sections are limited to allowed_site_types (empty = show all). */
  propertyPricingConfig?: { site_type_config?: { allowed_site_types?: string[] } } | null
}

export function getDisplayPrice(
  site: AvailableSite,
  stayType: BookingType
): { amountCents: number; unitLabel: string } {
  switch (stayType) {
    case 'weekly':
      return {
        amountCents: site.weekly_rate_cents ?? site.base_price_per_night * 7,
        unitLabel: '/week',
      }
    case 'monthly':
      return {
        amountCents: site.monthly_rate_cents ?? site.base_price_per_night * 28,
        unitLabel: '/month',
      }
    default:
      return { amountCents: site.base_price_per_night, unitLabel: '/night' }
  }
}

// Amenity icon mapping
const amenityIcons: Record<string, { icon: typeof Zap; label: string }> = {
  electric: { icon: Zap, label: 'Electric' },
  electricity: { icon: Zap, label: 'Electric' },
  water: { icon: Droplet, label: 'Water' },
  wifi: { icon: Wifi, label: 'WiFi' },
  firepit: { icon: Flame, label: 'Fire Pit' },
  petFriendly: { icon: PawPrint, label: 'Pet Friendly' },
}

// Site type icon mapping
const siteTypeIcons: Record<string, typeof Tent> = {
  tent: Tent,
  rv: Caravan,
  cabin: Home,
  glamping: Home,
  yurt: Home,
  other: Home,
}

const siteTypeLabels: Record<string, string> = {
  rv: 'RV Sites',
  tent: 'Tent Sites',
  cabin: 'Cabins',
  glamping: 'Glamping',
  yurt: 'Yurts',
  other: 'Other Sites',
}

const siteTypeOrder = ['rv', 'tent', 'cabin', 'glamping', 'yurt', 'other']

export function AvailableSitesAccordion({
  sites,
  selectedSiteId,
  onSiteSelect,
  stayType = 'nightly',
  propertyPricingConfig,
}: AvailableSitesAccordionProps) {
  const rawSiteTypeConfig = (propertyPricingConfig?.site_type_config ?? null) as
    | { allowed_site_types?: string[] }
    | null

  const allowedSiteTypesFromConfig =
    Array.isArray(rawSiteTypeConfig?.allowed_site_types) &&
    rawSiteTypeConfig.allowed_site_types.length > 0
      ? rawSiteTypeConfig.allowed_site_types
      : []

  const typesToRender =
    allowedSiteTypesFromConfig.length > 0
      ? siteTypeOrder.filter((t) =>
          allowedSiteTypesFromConfig.map((a) => a.toLowerCase()).includes(t)
        )
      : siteTypeOrder

  // Group sites by type
  const sitesByType = sites.reduce((acc, site) => {
    const type = site.site_type || 'other'
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(site)
    return acc
  }, {} as Record<string, AvailableSite[]>)

  // Initialize expanded state - all sections closed by default for cleaner UI
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    typesToRender.forEach((type) => {
      initial[type] = false
    })
    return initial
  })

  const toggleSection = (type: string) => {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  const handleSiteSelect = (siteId: string, siteType: string) => {
    onSiteSelect(siteId)
    // Auto-collapse the section after selection for cleaner UI
    setTimeout(() => {
      setExpanded((prev) => ({ ...prev, [siteType]: false }))
    }, 300)
  }

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  return (
    <div className="space-y-3">
      {typesToRender.map((type) => {
        const typeSites = sitesByType[type] || []
        const isEmpty = typeSites.length === 0
        const isExpanded = expanded[type]
        const label = siteTypeLabels[type] || type
        const selectedSiteInType = typeSites.find((s) => s.id === selectedSiteId)

        return (
          <div
            key={type}
            className={cn(
              'rounded-lg border bg-card',
              isEmpty && 'opacity-50',
              selectedSiteInType && 'border-primary'
            )}
          >
            {/* Accordion Header */}
            <button
              onClick={() => toggleSection(type)}
              className={cn(
                'w-full flex items-center justify-between p-4',
                'hover:bg-accent/50 transition-colors',
                'disabled:cursor-not-allowed'
              )}
              disabled={isEmpty}
              type="button"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{label}</span>
                  <span className="text-sm text-muted-foreground">
                    ({typeSites.length})
                  </span>
                </div>
              </div>

              {/* Show selected site summary when collapsed */}
              {!isExpanded && selectedSiteInType && (() => {
                const { amountCents, unitLabel } = getDisplayPrice(selectedSiteInType, stayType)
                return (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {selectedSiteInType.name} - {formatMoney(amountCents)}{unitLabel}
                    </Badge>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )
              })()}
            </button>

            {/* Accordion Content */}
            {isExpanded && !isEmpty && (
              <div className="px-4 pb-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {typeSites.map((site) => {
                    const SiteIcon = siteTypeIcons[site.site_type] || Home
                    const isSelected = site.id === selectedSiteId

                    // Get amenities that are true
                    const activeAmenities = Object.entries(site.amenities)
                      .filter(([, value]) => value === true)
                      .map(([key]) => key)
                      .slice(0, 4) // Limit to 4 amenities

                    return (
                      <button
                        key={site.id}
                        onClick={() => handleSiteSelect(site.id, type)}
                        type="button"
                        className={cn(
                          'relative rounded-lg border p-4 text-left transition-all',
                          'hover:border-primary hover:shadow-md',
                          isSelected && 'border-primary bg-primary/5 shadow-md'
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3">
                            <div className="rounded-full bg-primary p-1">
                              <Check className="h-4 w-4 text-primary-foreground" />
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          {/* Site Header */}
                          <div className="flex items-start justify-between pr-8">
                            <div className="flex items-center gap-2">
                              <SiteIcon className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <h3 className="font-semibold">{site.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  Site #{site.site_number}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Pricing */}
                          {(() => {
                            const { amountCents, unitLabel } = getDisplayPrice(site, stayType)
                            return (
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold">
                                  {formatMoney(amountCents)}
                                </span>
                                <span className="text-sm text-muted-foreground">{unitLabel}</span>
                              </div>
                            )
                          })()}

                          {/* Amenities */}
                          {activeAmenities.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {activeAmenities.map((amenityKey) => {
                                const amenity = amenityIcons[amenityKey]
                                if (!amenity) return null

                                const Icon = amenity.icon
                                return (
                                  <div
                                    key={amenityKey}
                                    className="flex items-center gap-1 text-xs text-muted-foreground"
                                    title={amenity.label}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    <span>{amenity.label}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Occupancy */}
                          <p className="text-sm text-muted-foreground">
                            Max {site.max_occupancy} {site.max_occupancy === 1 ? 'guest' : 'guests'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

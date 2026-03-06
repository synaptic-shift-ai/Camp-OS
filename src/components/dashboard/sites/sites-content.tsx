'use client'

/**
 * Sites Content Component
 *
 * Client component that manages the interactive filtering state.
 * Coordinates between status cards and accordion display.
 */

import { useState, useMemo } from 'react'
import { SitesStatsCards, type SiteStatus } from './sites-stats-cards'
import { SitesAccordion } from './sites-accordion'
import type { Database } from '@/contracts/db'
import type { PropertyPricingConfig } from '@/app/dashboard/[propertyId]/sites/page'

type Site = Database['public']['Tables']['sites']['Row']

interface SitesContentProps {
  sites: Site[]
  propertyPricingConfig?: PropertyPricingConfig | undefined
}

export function SitesContent({ sites, propertyPricingConfig }: SitesContentProps) {
  const [activeFilter, setActiveFilter] = useState<SiteStatus>('all')

  // Calculate stats from sites
  const stats = useMemo(() => {
    const statusCounts = sites.reduce((acc, site) => {
      const status = site.status || 'unavailable'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total: sites.length,
      available: statusCounts.available || 0,
      reserved: statusCounts.reserved || 0,
      booked: statusCounts.booked || 0,
      occupied: statusCounts.occupied || 0,
      housekeeping: statusCounts.housekeeping || 0,
      maintenance: statusCounts.maintenance || 0,
      unavailable: statusCounts.unavailable || 0,
    }
  }, [sites])

  // Filter sites by active status
  const filteredSites = useMemo(() => {
    if (activeFilter === 'all') {
      return sites
    }
    return sites.filter((site) => site.status === activeFilter)
  }, [sites, activeFilter])

  // Calculate total sites by type (for accordion headers)
  const totalSitesByType = useMemo(() => {
    return sites.reduce((acc, site) => {
      const type = site.site_type || 'other'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [sites])

  return (
    <div className="space-y-6">
      {/* Interactive Status Cards */}
      <SitesStatsCards
        stats={stats}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Filtered Sites Accordion */}
      <SitesAccordion
        sites={filteredSites}
        totalSitesByType={totalSitesByType}
        propertyPricingConfig={propertyPricingConfig}
      />
    </div>
  )
}

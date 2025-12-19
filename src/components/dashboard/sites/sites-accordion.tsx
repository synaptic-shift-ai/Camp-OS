'use client'

/**
 * Sites Accordion Component
 *
 * Groups sites by type in collapsible accordion sections.
 * Auto-expands sections with filtered results, collapses empty ones.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Database } from '@/contracts/db'
import { SitesGrid } from './sites-grid'
import type { PropertyPricingDefaults } from '@/app/dashboard/sites/page'

type Site = Database['public']['Tables']['sites']['Row']

interface SitesAccordionProps {
  sites: Site[]
  totalSitesByType: Record<string, number>
  propertyPricingDefaults?: PropertyPricingDefaults | undefined
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

export function SitesAccordion({ sites, totalSitesByType, propertyPricingDefaults }: SitesAccordionProps) {
  // Group sites by type
  const sitesByType = sites.reduce((acc, site) => {
    const type = site.site_type || 'other'
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(site)
    return acc
  }, {} as Record<string, Site[]>)

  // Initialize expanded state - expand sections with sites, collapse empty ones
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    siteTypeOrder.forEach((type) => {
      initial[type] = (sitesByType[type]?.length || 0) > 0
    })
    return initial
  })

  const toggleSection = (type: string) => {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  return (
    <div className="space-y-3">
      {siteTypeOrder.map((type) => {
        const typeSites = sitesByType[type] || []
        const filteredCount = typeSites.length
        const totalCount = totalSitesByType[type] || 0
        const isEmpty = filteredCount === 0
        const isExpanded = expanded[type]
        const label = siteTypeLabels[type] || type

        return (
          <div
            key={type}
            className={cn(
              'rounded-lg border bg-card',
              isEmpty && 'opacity-50'
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
                    ({filteredCount}{filteredCount !== totalCount && ` of ${totalCount}`})
                  </span>
                </div>
              </div>
            </button>

            {/* Accordion Content */}
            {isExpanded && !isEmpty && (
              <div className="px-4 pb-4">
                <SitesGrid sites={typeSites} propertyPricingDefaults={propertyPricingDefaults} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

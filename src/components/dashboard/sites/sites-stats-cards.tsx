'use client'

/**
 * Interactive Sites Stats Cards
 *
 * Displays site statistics with clickable filter functionality.
 * Click a card to filter sites by that status in the accordion below.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type SiteStatus = 'all' | 'available' | 'reserved' | 'booked' | 'occupied' | 'housekeeping' | 'maintenance' | 'unavailable'

interface SiteStats {
  total: number
  available: number
  reserved: number
  booked: number
  occupied: number
  housekeeping: number
  maintenance: number
  unavailable: number
}

interface SitesStatsCardsProps {
  stats: SiteStats
  activeFilter: SiteStatus
  onFilterChange: (filter: SiteStatus) => void
}

const statusCards = [
  { id: 'all' as const, label: 'Total Sites', key: 'total', color: 'text-foreground' },
  { id: 'available' as const, label: 'Available', key: 'available', color: 'text-green-500' },
  { id: 'reserved' as const, label: 'Reserved', key: 'reserved', color: 'text-orange-500' },
  { id: 'booked' as const, label: 'Booked', key: 'booked', color: 'text-cyan-500' },
  { id: 'occupied' as const, label: 'Occupied', key: 'occupied', color: 'text-blue-500' },
  { id: 'housekeeping' as const, label: 'Housekeeping', key: 'housekeeping', color: 'text-purple-500' },
  { id: 'maintenance' as const, label: 'Maintenance', key: 'maintenance', color: 'text-yellow-500' },
  { id: 'unavailable' as const, label: 'Unavailable', key: 'unavailable', color: 'text-red-500' },
]

export function SitesStatsCards({ stats, activeFilter, onFilterChange }: SitesStatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4 xl:grid-cols-8">
      {statusCards.map((card) => {
        const count = stats[card.key as keyof SiteStats] || 0
        const isActive = activeFilter === card.id

        return (
          <Card
            key={card.id}
            className={cn(
              'cursor-pointer transition-all duration-200',
              'hover:shadow-md hover:scale-105',
              isActive && 'ring-2 ring-primary shadow-lg scale-105'
            )}
            onClick={() => onFilterChange(card.id)}
          >
            <CardHeader className="p-2 pb-1 sm:p-4 sm:pb-2">
              <CardTitle className="text-left text-[9px] font-medium leading-tight text-muted-foreground sm:text-sm">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 pb-2 sm:p-4">
              <div className={cn('text-left text-2xl font-bold sm:text-2xl', card.color)}>
                {count}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

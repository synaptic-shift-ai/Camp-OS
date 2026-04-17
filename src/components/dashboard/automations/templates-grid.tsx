'use client'

/**
 * Templates Grid Component
 *
 * Displays automation templates organized by category sections.
 * Users can search by name/description across all sections.
 */

import { useState, useMemo } from 'react'
import { Search, Mail, Settings, Shield, DollarSign, FileText } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AutomationTemplate, TemplateCategory } from '@/lib/automations/templates'
import { TEMPLATE_CATEGORIES, PHASE_COLORS } from '@/lib/automations/templates'
import type { LucideIcon } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export type TemplatesGridProps = {
  templates: AutomationTemplate[]
  onTemplateClick: (template: AutomationTemplate) => void
}

// ============================================================================
// Category Icon & Color Map
// ============================================================================

const categoryConfig: Record<TemplateCategory, { icon: LucideIcon; color: string; description: string }> = {
  Availability: {
    icon: Shield,
    color: 'text-red-600 bg-red-50 dark:bg-red-950/30',
    description: 'Guard-phase rules that block or flag reservations before acceptance',
  },
  Pricing: {
    icon: DollarSign,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
    description: 'Price-phase rules for discounts, surcharges, and modifiers',
  },
  Documents: {
    icon: FileText,
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
    description: 'Enforce-phase rules for required documents and deposits',
  },
  'Guest Comms': {
    icon: Mail,
    color: 'text-green-600 bg-green-50 dark:bg-green-950/30',
    description: 'Communicate-phase rules for guest notifications and alerts',
  },
  Operations: {
    icon: Settings,
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
    description: 'Operate-phase rules for work orders, staff, and site management',
  },
}

// ============================================================================
// Component
// ============================================================================

export function TemplatesGrid({
  templates,
  onTemplateClick,
}: TemplatesGridProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filteredByCategory = useMemo(() => {
    return TEMPLATE_CATEGORIES.map((category) => {
      if (categoryFilter !== 'all' && category !== categoryFilter) {
        return { category, templates: [] as AutomationTemplate[] }
      }
      const categoryTemplates = templates.filter((template) => {
        if (template.category !== category) return false

        if (search) {
          const searchLower = search.toLowerCase()
          const nameMatch = template.name.toLowerCase().includes(searchLower)
          const descMatch = template.description.toLowerCase().includes(searchLower)
          if (!nameMatch && !descMatch) return false
        }

        return true
      })
      return { category, templates: categoryTemplates }
    }).filter((group) => group.templates.length > 0)
  }, [templates, search, categoryFilter])

  const hasResults = filteredByCategory.some((group) => group.templates.length > 0)
  const totalVisible = filteredByCategory.reduce((sum, group) => sum + group.templates.length, 0)

  return (
    <div className="space-y-6">
      {/* Search + Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasResults ? (
        <>
          <p className="text-sm text-muted-foreground">
            Showing {totalVisible} of {templates.length} templates
          </p>

          {filteredByCategory.map((group) => {
            const config = categoryConfig[group.category]
            const CategoryIcon = config.icon

            return (
              <div key={group.category} className="space-y-3">
                {/* Section Header */}
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.color}`}>
                    <CategoryIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{group.category}</h3>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {group.templates.length}
                  </Badge>
                </div>

                {/* Template Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.templates.map((template) => {
                    const phaseColorClass = PHASE_COLORS[template.phase]

                    return (
                      <Card
                        key={template.id}
                        className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/50"
                        onClick={() => onTemplateClick(template)}
                      >
                        <CardHeader className="pb-1.5 sm:pb-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-sm leading-tight">{template.name}</CardTitle>
                            <Badge variant="outline" className={`shrink-0 text-[10px] ${phaseColorClass}`}>
                              {template.phase}
                            </Badge>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground block">
                            {template.triggerType}
                          </span>
                        </CardHeader>
                        <CardContent className="pt-0 sm:pt-0 pb-3">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No templates match your search.</p>
          <Button
            variant="link"
            onClick={() => { setSearch(''); setCategoryFilter('all') }}
            className="mt-2"
          >
            Clear search
          </Button>
        </div>
      )}
    </div>
  )
}

"use client"

import { Building2, CheckCircle2, Circle } from "lucide-react"
import { useProperty } from "@/components/property-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export function PropertySwitcher() {
  const { properties, selectedPropertyId, selectProperty, isLoading } = useProperty()

  // Don't show if only one property or still loading
  if (isLoading || properties.length <= 1) {
    return null
  }

  return (
    <div className="border-b border-border p-4">
      <Select value={selectedPropertyId || ""} onValueChange={selectProperty}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Select property" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {properties.map((property) => (
            <SelectItem key={property.id} value={property.id}>
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-2">
                  {property.onboarding_completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="truncate">{property.name}</span>
                </div>
                {property.site_count !== undefined && property.site_count > 0 && (
                  <Badge variant="outline" className="ml-auto flex-shrink-0">
                    {property.site_count} {property.site_count === 1 ? "site" : "sites"}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

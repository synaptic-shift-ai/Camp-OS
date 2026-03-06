"use client"

import { startTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
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
  const router = useRouter()
  const pathname = usePathname()
  const { properties, selectedPropertyId, selectProperty, isLoading } = useProperty()

  const handlePropertyChange = (newPropertyId: string) => {
    selectProperty(newPropertyId)
    const segments = pathname.split("/").filter(Boolean)
    const newPath =
      segments[0] === "dashboard" && segments[1]
        ? segments.slice(2).length > 0
          ? `/dashboard/${newPropertyId}/${segments.slice(2).join("/")}`
          : `/dashboard/${newPropertyId}`
        : `/dashboard/${newPropertyId}`
    startTransition(() => {
      router.push(newPath)
    })
  }

  if (isLoading) {
    return (
      <div className="border-b border-border p-4">
        <div className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-muted/30 px-3">
          <div className="h-4 w-4 shrink-0 rounded bg-muted animate-pulse" />
          <div className="h-4 flex-1 max-w-[140px] rounded bg-muted animate-pulse" />
        </div>
      </div>
    )
  }

  if (properties.length <= 1) {
    return null
  }

  return (
    <div className="border-b border-border p-4">
      <Select value={selectedPropertyId || ""} onValueChange={handlePropertyChange}>
        <SelectTrigger className="w-full focus:ring-0 focus:ring-offset-0">
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
                  {property.onboardingCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="truncate">{property.name}</span>
                </div>
                {property.siteCount !== undefined && property.siteCount > 0 && (
                  <Badge variant="outline" className="ml-auto flex-shrink-0">
                    {property.siteCount} {property.siteCount === 1 ? "site" : "sites"}
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

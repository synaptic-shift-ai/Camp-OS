import { Suspense } from "react"
import { redirect } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { WizardContainer } from "@/components/dashboard/setup-wizard/wizard-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, Plus, Tent, Home, TreePine, Sparkles, Circle, MapPin } from "lucide-react"
import { getSites, getSiteStats } from "@/lib/dashboard/queries"
import { createClient } from "@/lib/supabase/server"
import type { SiteType } from "@/lib/booking/types"

const siteTypeIcons: Record<SiteType, LucideIcon> = {
  rv: Home,
  tent: Tent,
  cabin: TreePine,
  glamping: Sparkles,
  yurt: Circle,
  other: MapPin,
}

type SiteStatus = 'available' | 'occupied' | 'maintenance' | 'unavailable'

const statusColors: Record<SiteStatus, string> = {
  available: "bg-green-500/10 text-green-500 border-green-500/20",
  occupied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  unavailable: "bg-red-500/10 text-red-500 border-red-500/20",
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

/**
 * Get the current user's property ID
 * MVP: Assumes user has access to one property
 */
async function getCurrentPropertyId(): Promise<string | null> {
  const supabase = await createClient()

  // Get the currently authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get the first property owned by this user
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  return property?.id || null
}

async function SitesList() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No property found. Please contact support.</p>
      </div>
    )
  }

  // Fetch all sites for this property
  const { data: sites } = await getSites(propertyId)

  if (sites.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No sites yet. Add your first site!</p>
        <Button className="mt-4 gap-2">
          <Plus className="h-4 w-4" />
          Add Site
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sites.map((site) => {
        const Icon = siteTypeIcons[site.siteType as SiteType] || MapPin
        return (
          <Card key={site.id} className="relative overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Site {site.siteNumber}</CardTitle>
                    <CardDescription className="text-sm">{site.siteName || `Site ${site.siteNumber}`}</CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                    <DropdownMenuItem>Edit Site</DropdownMenuItem>
                    <DropdownMenuItem>View Calendar</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">Delete Site</DropdownMenuItem>
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
                  {site.siteType}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Occupancy</span>
                  <span className="font-medium">{site.maxOccupancy} guests</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Price</span>
                  <span className="font-medium">{formatMoney(site.basePrice)}/night</span>
                </div>
                {site.hookups.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hookups</span>
                    <span className="font-medium capitalize">{site.hookups.join(", ")}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

async function SitesStats() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return null
  }

  const stats = await getSiteStats(propertyId)

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Sites</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">{stats.available}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Occupied</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-500">{stats.occupied}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-500">{stats.maintenance}</div>
        </CardContent>
      </Card>
    </div>
  )
}

interface SitesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SitesPage({ searchParams }: SitesPageProps) {
  const params = await searchParams
  const isWizardMode = params.wizard === "true"
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : null

  // Show wizard if wizard mode is active
  if (isWizardMode) {
    return <WizardContainer initialPropertyId={propertyId} />
  }

  // Normal sites view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Sites</h1>
          <p className="text-muted-foreground">Manage your property sites and units</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Site
        </Button>
      </div>

      {/* Sites Grid */}
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-8 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <SitesList />
      </Suspense>

      {/* Site Stats */}
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <SitesStats />
      </Suspense>
    </div>
  )
}

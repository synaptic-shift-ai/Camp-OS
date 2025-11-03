import { Suspense } from "react"
import { WizardContainer } from "@/components/dashboard/setup-wizard/wizard-container"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSiteStats } from "@/lib/dashboard/queries"
import { createClient } from "@/lib/supabase/server"
import { SitesPageHeader } from "@/components/dashboard/sites/sites-page-header"
import { SitesGrid } from "@/components/dashboard/sites/sites-grid"

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

  // Fetch all sites for this property - raw database format for full editing capability
  const supabase = await createClient()
  const { data: sites } = await supabase
    .from('sites')
    .select('*')
    .eq('property_id', propertyId)
    .order('site_number', { ascending: true })

  // Pass raw sites data to client component
  return <SitesGrid sites={sites || []} />
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

  // Get current property ID for bulk upload
  const currentPropertyId = await getCurrentPropertyId()

  // Normal sites view
  return (
    <div className="space-y-6">
      <SitesPageHeader propertyId={currentPropertyId} />

      {/* Site Stats - Always at top */}
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
    </div>
  )
}

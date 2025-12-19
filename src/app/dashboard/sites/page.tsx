import { Suspense } from "react"
import { WizardContainer } from "@/components/dashboard/setup-wizard/wizard-container"
import { createClient } from "@/lib/supabase/server"
import { SitesPageHeader } from "@/components/dashboard/sites/sites-page-header"
import { SitesContent } from "@/components/dashboard/sites/sites-content"

/**
 * Property pricing defaults from reservation_type_config
 */
export type PropertyPricingDefaults = {
  nightlyRateCents: number | null
  weeklyRateCents: number | null
  monthlyRateCents: number | null
  seasonalRateCents: number | null
}

/**
 * Get the current user's property ID and pricing defaults
 * MVP: Assumes user has access to one property
 */
async function getCurrentProperty(): Promise<{
  id: string
  pricingDefaults: PropertyPricingDefaults
} | null> {
  const supabase = await createClient()

  // Get the currently authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get the first property owned by this user with pricing config
  const { data: property } = await supabase
    .from('properties')
    .select('id, reservation_type_config')
    .eq('owner_id', user.id)
    .single()

  if (!property) {
    return null
  }

  // Extract pricing defaults from reservation_type_config
  const config = property.reservation_type_config as Record<string, any> | null
  const pricingDefaults: PropertyPricingDefaults = {
    nightlyRateCents: config?.nightly?.rate_cents ?? null,
    weeklyRateCents: config?.weekly?.rate_cents ?? null,
    monthlyRateCents: config?.monthly?.rate_cents ?? null,
    seasonalRateCents: config?.seasonal?.rate_cents ?? null,
  }

  return { id: property.id, pricingDefaults }
}

async function SitesView() {
  const property = await getCurrentProperty()

  if (!property) {
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
    .eq('property_id', property.id)
    .order('site_number', { ascending: true })

  if (!sites || sites.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No sites yet. Add your first site!</p>
      </div>
    )
  }

  // Pass sites and property pricing defaults to client component
  return <SitesContent sites={sites} propertyPricingDefaults={property.pricingDefaults} />
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
  const property = await getCurrentProperty()
  const currentPropertyId = property?.id ?? null

  // Normal sites view
  return (
    <div className="space-y-6">
      <SitesPageHeader propertyId={currentPropertyId} />

      {/* Sites View with Stats + Filtered Accordion */}
      <Suspense
        fallback={
          <div className="space-y-6">
            {/* Stats skeleton */}
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-4">
                  <div className="h-4 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-8 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
            {/* Accordion skeleton */}
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-4">
                  <div className="h-6 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>
        }
      >
        <SitesView />
      </Suspense>
    </div>
  )
}

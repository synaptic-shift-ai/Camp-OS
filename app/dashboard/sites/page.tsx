import { Suspense } from "react"
import { WizardContainer } from "@/components/dashboard/setup-wizard/wizard-container"
import { createClient } from "@/lib/supabase/server"
import { SitesPageHeader } from "@/components/dashboard/sites/sites-page-header"
import { SitesContent } from "@/components/dashboard/sites/sites-content"

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

async function SitesView() {
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

  if (!sites || sites.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No sites yet. Add your first site!</p>
      </div>
    )
  }

  // Pass sites to client component that handles stats + accordion
  return <SitesContent sites={sites} />
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

      {/* Sites View with Stats + Filtered Accordion */}
      <Suspense
        fallback={
          <div className="space-y-6">
            {/* Stats skeleton */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
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

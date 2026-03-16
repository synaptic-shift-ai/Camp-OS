import { Suspense } from "react"
import { WizardContainer } from "@/components/dashboard/setup-wizard/wizard-container"
import { createClient } from "@/lib/supabase/server"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { redirect } from "next/navigation"
import { SitesPageHeader } from "@/components/dashboard/sites/sites-page-header"
import { SitesContent } from "@/components/dashboard/sites/sites-content"
import {
  parseReservationTypesConfigFromDB,
  parseEnabledReservationTypesFromDB,
} from "@/lib/config/resolution"

/**
 * Reservation type with pricing info
 */
export type ReservationTypeConfig = {
  type: 'nightly' | 'weekly' | 'monthly' | 'seasonal'
  enabled: boolean
  rateCents: number | null
  label: string
}

/** Site type rates from property.site_type_config (per site type: nightly, weekly, monthly, seasonal) */
export type SiteTypeRatesConfig = Record<
  string,
  {
    nightly?: { rate_cents: number | null }
    weekly?: { rate_cents: number | null }
    monthly?: { rate_cents: number | null }
    seasonal?: { rate_cents: number | null }
  }
>

/**
 * Property pricing configuration including enabled types and rates
 */
export type PropertyPricingConfig = {
  enabledTypes: ('nightly' | 'weekly' | 'monthly' | 'seasonal')[]
  rates: ReservationTypeConfig[]
  /** From property.site_type_config.site_type_rates; used when site pricing source is site_type_default */
  siteTypeConfig?: { site_type_rates?: SiteTypeRatesConfig } | null
}

const TYPE_LABELS: Record<string, string> = {
  nightly: 'Nightly',
  weekly: 'Weekly',
  monthly: 'Monthly',
  seasonal: 'Seasonal',
}

async function getPropertyWithPricing(propertyId: string): Promise<{
  id: string
  pricingConfig: PropertyPricingConfig
  allowedSiteTypes: string[] | null
} | null> {
  const property = await getPropertyForUser(propertyId)
  if (!property) return null

  const parsedEnabledTypes = parseEnabledReservationTypesFromDB(property.enabled_reservation_types)
  const parsedConfig = parseReservationTypesConfigFromDB(property.reservation_type_config)

  const standardTypes = ["nightly", "weekly", "monthly", "seasonal"] as const
  type StandardType = (typeof standardTypes)[number]
  const enabledTypes = parsedEnabledTypes.filter((t): t is StandardType =>
    standardTypes.includes(t as StandardType)
  ) as StandardType[]

  const rates: ReservationTypeConfig[] = standardTypes.map((type) => ({
    type,
    enabled: enabledTypes.includes(type),
    rateCents: parsedConfig[type]?.rate_cents ?? null,
    label: TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1),
  }))

  const rawSiteTypeConfig = (property.site_type_config ?? null) as
    | { site_type_rates?: SiteTypeRatesConfig; allowed_site_types?: string[] }
    | null

  const allowedSiteTypes =
    Array.isArray(rawSiteTypeConfig?.allowed_site_types) && rawSiteTypeConfig.allowed_site_types.length > 0
      ? rawSiteTypeConfig.allowed_site_types
      : null

  return {
    id: property.id,
    pricingConfig: {
      enabledTypes,
      rates,
      siteTypeConfig: rawSiteTypeConfig ?? null,
    },
    allowedSiteTypes,
  }
}

async function SitesView({ propertyId }: { propertyId: string }) {
  const property = await getPropertyWithPricing(propertyId)

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
      <>
        <SitesPageHeader propertyId={property.id} sites={[]} />
        <div className="text-center py-12">
          <p className="text-muted-foreground">No sites yet. Add your first site!</p>
        </div>
      </>
    )
  }

  const allowedSiteTypes = property.allowedSiteTypes
  const sitesForDisplay =
    allowedSiteTypes && allowedSiteTypes.length > 0
      ? sites.filter((site) =>
          allowedSiteTypes
            .map((t) => t.toLowerCase())
            .includes((site.site_type || 'other').toLowerCase())
        )
      : sites

  // Pass sites and property pricing config to client component
  return (
    <>
      <SitesPageHeader propertyId={property.id} sites={sitesForDisplay} />
      <SitesContent sites={sitesForDisplay} propertyPricingConfig={property.pricingConfig} />
    </>
  )
}

type PageProps = {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SitesPage({ params, searchParams }: PageProps) {
  const { propertyId } = await params
  const search = await searchParams
  const isWizardMode = search.wizard === "true"

  if (isWizardMode) {
    return <WizardContainer initialPropertyId={propertyId} />
  }

  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  return (
    <div className="space-y-6">
      {/* Sites View with Header + Stats + Filtered Accordion */}
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
        <SitesView propertyId={propertyId} />
      </Suspense>
    </div>
  )
}

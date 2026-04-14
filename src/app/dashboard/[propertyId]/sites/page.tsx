import { Suspense } from "react"
import { WizardContainer } from "@/components/dashboard/setup-wizard/wizard-container"
import { createClient } from "@/lib/supabase/server"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { resolveUserPropertyAccess } from "@/lib/rbac/resolve-access"
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

type UiRole = 'owner' | 'admin' | 'manager' | 'staff'

type SitesActionPermissions = {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

const TYPE_LABELS: Record<string, string> = {
  nightly: 'Nightly',
  weekly: 'Weekly',
  monthly: 'Monthly',
  seasonal: 'Seasonal',
}

function toUiRole(rawRole: string | null): UiRole {
  const normalized = (rawRole ?? '').toLowerCase()
  if (normalized === 'owner') return 'owner'
  if (normalized === 'admin' || normalized === 'property_admin') return 'admin'
  if (normalized === 'manager') return 'manager'
  return 'staff'
}

function normalizeAccessPayload(
  raw: unknown,
): { moduleAccessControl?: Record<string, Record<string, boolean>> } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const maybe = raw as { moduleAccessControl?: unknown }
  if (
    !maybe.moduleAccessControl ||
    typeof maybe.moduleAccessControl !== 'object' ||
    Array.isArray(maybe.moduleAccessControl)
  ) {
    return null
  }
  return { moduleAccessControl: maybe.moduleAccessControl as Record<string, Record<string, boolean>> }
}

function fallbackSitesPermissionsForCategory(role: UiRole, categoryName: string): SitesActionPermissions {
  if (role === 'owner' || role === 'admin') {
    return { view: true, create: true, edit: true, delete: true }
  }

  const category = categoryName.trim().toLowerCase()
  if (role === 'manager' && (category === 'front desk' || category === 'housekeeping' || category === 'maintenance')) {
    return { view: true, create: false, edit: false, delete: false }
  }

  return { view: false, create: false, edit: false, delete: false }
}

async function resolveSitesActionPermissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<SitesActionPermissions> {
  const resolvedAccess = await resolveUserPropertyAccess(supabase, propertyId, userId)
  if (resolvedAccess?.isOwner) {
    return { view: true, create: true, edit: true, delete: true }
  }

  const { data: staffAssignment } = await supabase
    .from('property_staff')
    .select('role, role_category_id')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .maybeSingle()

  // Fallback: if no explicit staff-role assignment exists, keep elevated users fully enabled.
  if (!staffAssignment?.role && resolvedAccess?.isElevated) {
    return { view: true, create: true, edit: true, delete: true }
  }

  const role = toUiRole(typeof staffAssignment?.role === 'string' ? staffAssignment.role : null)
  if (role === 'owner') {
    return { view: true, create: true, edit: true, delete: true }
  }

  const categoryIds = staffAssignment?.role_category_id ?? []
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    if (role === 'admin') {
      // Admin fallback when no category rows are assigned.
      return { view: true, create: true, edit: true, delete: true }
    }
    return { view: false, create: false, edit: false, delete: false }
  }

  const { data: categoryRows } = await supabase
    .from('property_role_categories')
    .select('name, access')
    .eq('property_id', propertyId)
    .eq('role', role)
    .in('id', categoryIds)

  const resolved: SitesActionPermissions = { view: false, create: false, edit: false, delete: false }
  const rows = categoryRows ?? []
  const hasExplicitSitesAccess = rows.some((row) => {
    const access = normalizeAccessPayload(row.access)
    return Boolean(access?.moduleAccessControl?.sites)
  })

  if (rows.length === 0) {
    if (role === 'admin') {
      // Admin fallback when assigned categories could not be resolved.
      return { view: true, create: true, edit: true, delete: true }
    }
    return resolved
  }

  // If at least one category has explicit sites access config, honor explicit
  // entries only so "false" toggles are not overridden by fallback defaults.
  if (hasExplicitSitesAccess) {
    for (const row of rows) {
      const access = normalizeAccessPayload(row.access)
      const sitesAccess = access?.moduleAccessControl?.sites
      if (!sitesAccess) continue
      resolved.view = resolved.view || sitesAccess.view === true
      resolved.create = resolved.create || sitesAccess.create === true
      resolved.edit = resolved.edit || sitesAccess.edit === true
      resolved.delete = resolved.delete || sitesAccess.delete === true
    }
    return resolved
  }

  for (const row of rows) {
    const fallback = fallbackSitesPermissionsForCategory(role, row.name ?? '')
    resolved.view = resolved.view || fallback.view
    resolved.create = resolved.create || fallback.create
    resolved.edit = resolved.edit || fallback.edit
    resolved.delete = resolved.delete || fallback.delete
  }

  return resolved
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

async function SitesView({
  propertyId,
  canCreateSite,
  canEditSite,
  canDeleteSite,
  canUpdateSiteStatus,
}: {
  propertyId: string
  canCreateSite: boolean
  canEditSite: boolean
  canDeleteSite: boolean
  canUpdateSiteStatus: boolean
}) {
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
    .is('deleted_at', null)
    .order('site_number', { ascending: true })

  if (!sites || sites.length === 0) {
    return (
      <>
        <SitesPageHeader propertyId={property.id} sites={[]} canCreateSite={canCreateSite} />
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
    <div className="space-y-4 sm:space-y-6">
      <SitesPageHeader
        propertyId={property.id}
        sites={sitesForDisplay}
        canCreateSite={canCreateSite}
      />
      <SitesContent
        sites={sitesForDisplay}
        propertyPricingConfig={property.pricingConfig}
        canEditSite={canEditSite}
        canDeleteSite={canDeleteSite}
        canUpdateSiteStatus={canUpdateSiteStatus}
      />
    </div>
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

  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible.sites) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }
  const sitePermissions = await resolveSitesActionPermissions(supabase, propertyId, user.id)

  if (isWizardMode) {
    return <WizardContainer initialPropertyId={propertyId} />
  }

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
        <SitesView
          propertyId={propertyId}
          canCreateSite={sitePermissions.create}
          canEditSite={sitePermissions.edit}
          canDeleteSite={sitePermissions.delete}
          canUpdateSiteStatus={sitePermissions.edit}
        />
      </Suspense>
    </div>
  )
}

import { createClient } from "@/lib/supabase/server"
import { getReservations, getDistinctSiteTypes, getSites } from "@/lib/dashboard/queries"
import type { ReservationFilters } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { resolveUserPropertyAccess } from "@/lib/rbac/resolve-access"
import type { BookingRulesConfig, RateDiscountsConfig } from "@/lib/config/types"
import type { ReservationStatus } from "@/contracts/booking"
import { redirect } from "next/navigation"
import { ReservationsTable } from "@/components/dashboard/reservations/reservations-table"
import { ReservationsTimeline } from "@/components/dashboard/reservations/timeline/reservation-timeline"
import { ReservationsViewSwitcher } from "@/components/dashboard/reservations/reservations-view-switcher"
import { ReservationsPageHeader } from "@/components/dashboard/reservations/reservations-page-header"
import { ReservationFilters as ReservationFiltersBar } from "@/components/dashboard/reservations/reservation-filters"

type PageProps = {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{
    siteType?: string
    status?: string
    search?: string
    searchBy?: string
    sortBy?: string
    sortOrder?: string
    page?: string
    pageSize?: string
    view?: string
    period?: string
    periodStart?: string
    periodEnd?: string
  }>
}

type UiRole = 'owner' | 'admin' | 'manager' | 'staff'

type ReservationActionPermissions = {
  view: boolean
  create: boolean
  modify: boolean
  checkIn: boolean
  checkOut: boolean
  cancel: boolean
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

function fallbackReservationsPermissionsForCategory(
  role: UiRole,
  categoryName: string,
): ReservationActionPermissions {
  if (role === 'owner' || role === 'admin') {
    return { view: true, create: true, modify: true, checkIn: true, checkOut: true, cancel: true }
  }

  const category = categoryName.trim().toLowerCase()
  if (role === 'manager' && category === 'front desk') {
    return { view: true, create: false, modify: false, checkIn: true, checkOut: true, cancel: false }
  }
  if (role === 'staff' && category === 'front desk') {
    return { view: true, create: false, modify: false, checkIn: true, checkOut: true, cancel: false }
  }

  return { view: false, create: false, modify: false, checkIn: false, checkOut: false, cancel: false }
}

async function resolveReservationActionPermissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<ReservationActionPermissions> {
  const resolvedAccess = await resolveUserPropertyAccess(supabase, propertyId, userId)
  if (resolvedAccess?.isOwner) {
    return { view: true, create: true, modify: true, checkIn: true, checkOut: true, cancel: true }
  }

  const { data: staffAssignment } = await supabase
    .from('property_staff')
    .select('role, role_category_id')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .maybeSingle()

  if (!staffAssignment?.role && resolvedAccess?.isElevated) {
    return { view: true, create: true, modify: true, checkIn: true, checkOut: true, cancel: true }
  }

  const role = toUiRole(typeof staffAssignment?.role === 'string' ? staffAssignment.role : null)
  if (role === 'owner') {
    return { view: true, create: true, modify: true, checkIn: true, checkOut: true, cancel: true }
  }

  const categoryIds = staffAssignment?.role_category_id ?? []
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    if (role === 'admin') {
      return { view: true, create: true, modify: true, checkIn: true, checkOut: true, cancel: true }
    }
    return { view: false, create: false, modify: false, checkIn: false, checkOut: false, cancel: false }
  }

  const { data: categoryRows } = await supabase
    .from('property_role_categories')
    .select('name, access')
    .eq('property_id', propertyId)
    .eq('role', role)
    .in('id', categoryIds)

  const rows = categoryRows ?? []
  const resolved: ReservationActionPermissions = {
    view: false,
    create: false,
    modify: false,
    checkIn: false,
    checkOut: false,
    cancel: false,
  }

  if (rows.length === 0) {
    if (role === 'admin') {
      return { view: true, create: true, modify: true, checkIn: true, checkOut: true, cancel: true }
    }
    return resolved
  }

  const hasExplicitReservationsAccess = rows.some((row) => {
    const access = normalizeAccessPayload(row.access)
    return Boolean(access?.moduleAccessControl?.reservations)
  })

  if (hasExplicitReservationsAccess) {
    for (const row of rows) {
      const access = normalizeAccessPayload(row.access)
      const reservationAccess = access?.moduleAccessControl?.reservations
      if (!reservationAccess) continue
      resolved.view = resolved.view || reservationAccess.view === true
      resolved.create = resolved.create || reservationAccess.create === true
      resolved.modify = resolved.modify || reservationAccess.modify === true
      resolved.checkIn = resolved.checkIn || reservationAccess['check-in'] === true
      resolved.checkOut = resolved.checkOut || reservationAccess['check-out'] === true
      resolved.cancel = resolved.cancel || reservationAccess.cancel === true
    }
    return resolved
  }

  for (const row of rows) {
    const fallback = fallbackReservationsPermissionsForCategory(role, row.name ?? '')
    resolved.view = resolved.view || fallback.view
    resolved.create = resolved.create || fallback.create
    resolved.modify = resolved.modify || fallback.modify
    resolved.checkIn = resolved.checkIn || fallback.checkIn
    resolved.checkOut = resolved.checkOut || fallback.checkOut
    resolved.cancel = resolved.cancel || fallback.cancel
  }

  return resolved
}

export default async function ReservationsPage({ params, searchParams }: PageProps) {
  const { propertyId } = await params
  const {
    siteType: siteTypeParam,
    status: statusParam,
    search: searchParam,
    searchBy: searchByParam,
    sortBy: sortByParam,
    sortOrder: sortOrderParam,
    page: pageParam,
    pageSize: pageSizeParam,
    view: viewParam,
    period: periodParam,
    periodStart: periodStartParam,
  } =
    await searchParams

  const isTimelineView = viewParam === "timeline" || viewParam === "grid"
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible.reservations) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }
  const reservationPermissions = await resolveReservationActionPermissions(supabase, propertyId, user.id)

  const rawSiteTypeConfig = (property as { site_type_config?: { allowed_site_types?: string[] } } | null)?.site_type_config ?? null
  const allowedSiteTypes =
    Array.isArray(rawSiteTypeConfig?.allowed_site_types) && rawSiteTypeConfig.allowed_site_types.length > 0
      ? rawSiteTypeConfig.allowed_site_types.map((t) => t.toLowerCase())
      : null

  const currentPage = Number.isNaN(Number(pageParam)) || !pageParam ? 1 : Math.max(1, Number(pageParam))
  const parsedPageSize =
    Number.isNaN(Number(pageSizeParam)) || !pageSizeParam
      ? undefined
      : Number(pageSizeParam)
  const pageSize = parsedPageSize && parsedPageSize > 0 ? parsedPageSize : 10

  const effectivePage = isTimelineView ? 1 : currentPage
  // Grid needs enough data to render the selected period without relying on list pagination.
  // Use a large limit so switching from List -> Grid doesn't "trim" results.
  const effectivePageSize = isTimelineView ? 100000 : pageSize

  type PeriodPreset = "day" | "week" | "month"
  const periodPreset: PeriodPreset =
    periodParam === "day" || periodParam === "week" || periodParam === "month" ? periodParam : isTimelineView ? "month" : "day"

  // When rendering from List -> Timeline, we need the Timeline link to default to Month
  // even if the current page request is in List view (where periodPreset defaults to Day).
  const timelinePeriodPreset: PeriodPreset =
    periodParam === "day" || periodParam === "week" || periodParam === "month" ? periodParam : "month"

  const isValidYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)
  const todayUtc = new Date()
  const todayYmd = `${todayUtc.getUTCFullYear()}-${String(todayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(
    todayUtc.getUTCDate()
  ).padStart(2, "0")}`
  const firstDayOfCurrentMonthYmd = `${todayUtc.getUTCFullYear()}-${String(todayUtc.getUTCMonth() + 1).padStart(2, "0")}-01`

  const periodStartYmd =
    typeof periodStartParam === "string" && isValidYmd(periodStartParam)
      ? periodStartParam
      : periodPreset === "month"
        ? firstDayOfCurrentMonthYmd
        : todayYmd
  const normalizedPeriodStartYmd =
    periodPreset === "month"
      ? `${periodStartYmd.slice(0, 7)}-01`
      : periodStartYmd

  const startUtc = new Date(`${normalizedPeriodStartYmd}T00:00:00.000Z`)
  const addDaysUtc = (d: Date, days: number) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
  const getPeriodDayCount = (selectedPreset: PeriodPreset, selectedStartUtc: Date) => {
    if (selectedPreset === "day") return 1
    if (selectedPreset === "week") return 7
    return new Date(Date.UTC(selectedStartUtc.getUTCFullYear(), selectedStartUtc.getUTCMonth() + 1, 0)).getUTCDate()
  }
  const periodDayCount = getPeriodDayCount(periodPreset, startUtc)
  const periodEndYmd = (() => {
    const endInclusive = addDaysUtc(startUtc, periodDayCount - 1)
    return `${endInclusive.getUTCFullYear()}-${String(endInclusive.getUTCMonth() + 1).padStart(2, "0")}-${String(
      endInclusive.getUTCDate()
    ).padStart(2, "0")}`
  })()

  const timelinePeriodDayCount = getPeriodDayCount(timelinePeriodPreset, startUtc)
  const timelinePeriodEndYmd = (() => {
    const endInclusive = addDaysUtc(startUtc, timelinePeriodDayCount - 1)
    return `${endInclusive.getUTCFullYear()}-${String(endInclusive.getUTCMonth() + 1).padStart(2, "0")}-${String(
      endInclusive.getUTCDate()
    ).padStart(2, "0")}`
  })()

  const siteTypesFromDb = await getDistinctSiteTypes(propertyId)
  const { data: allSites } = await getSites(propertyId)
  const timelineSites = allSites.filter((site) => {
    if (allowedSiteTypes && !allowedSiteTypes.includes(site.siteType.toLowerCase())) return false
    return true
  })
  const siteTypeFilter = siteTypeParam && siteTypeParam !== 'all' ? siteTypeParam : undefined
  const statusFilter =
    statusParam === 'pending' ||
      statusParam === 'confirmed' ||
      statusParam === 'checked_in' ||
      statusParam === 'checked_out' ||
      statusParam === 'cancelled' ||
      statusParam === 'no_show'
      ? (statusParam as ReservationStatus)
      : undefined
  const sortBy: NonNullable<ReservationFilters["sortBy"]> =
    sortByParam === 'confirmation' ||
      sortByParam === 'guest' ||
      sortByParam === 'site' ||
      sortByParam === 'checkIn' ||
      sortByParam === 'checkOut' ||
      sortByParam === 'nights' ||
      sortByParam === 'guests' ||
      sortByParam === 'totalAmount' ||
      sortByParam === 'paidAmount' ||
      sortByParam === 'balanceOwed' ||
      sortByParam === 'refundedAmount' ||
      sortByParam === 'status'
      ? sortByParam
      : 'checkIn'
  const sortOrder: NonNullable<ReservationFilters["sortOrder"]> =
    sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : 'desc'
  const searchField: NonNullable<ReservationFilters["searchField"]> =
    searchByParam === 'confirmation' || searchByParam === 'guest' || searchByParam === 'site'
      ? searchByParam
      : 'guest'

  const filters: ReservationFilters = {
    sortBy,
    sortOrder,
    searchField,
  }
  if (typeof searchParam === 'string' && searchParam.length > 0) filters.search = searchParam
  if (statusFilter) filters.status = statusFilter
  if (siteTypeFilter) filters.siteType = siteTypeFilter
  if (allowedSiteTypes) filters.allowedSiteTypes = allowedSiteTypes

  // Normalize timeline-period query params so the timeline controls are always reflected in the URL.
  if (isTimelineView) {
    const isValidPreset = periodParam === "day" || periodParam === "week" || periodParam === "month"
    const isValidStart = typeof periodStartParam === "string" && isValidYmd(periodStartParam)
    if (!isValidPreset || !isValidStart) {
      const params = new URLSearchParams()

      if (siteTypeFilter) params.set("siteType", siteTypeFilter)
      if (statusFilter) params.set("status", statusFilter)
      if (typeof searchParam === "string" && searchParam.length > 0) params.set("search", searchParam)
      if (searchField !== "guest") params.set("searchBy", searchField)

      params.set("view", "timeline")
      params.set("period", periodPreset)
      params.set("periodStart", normalizedPeriodStartYmd)
      params.set("periodEnd", periodEndYmd)

      redirect(`/dashboard/${propertyId}/reservations?${params.toString()}`)
    }
  }

  // Timeline view is filtered strictly to the selected time period.
  // This makes the timeline render all reservations for the period (no dependency on list pagination).
  if (isTimelineView) {
    filters.startDate = normalizedPeriodStartYmd
    filters.endDate = periodEndYmd
  }

  const { data: reservations, total } = await getReservations(propertyId, filters, effectivePage, effectivePageSize)
  const hasActiveFilters =
    Boolean(siteTypeFilter) ||
    Boolean(statusFilter) ||
    (typeof searchParam === "string" && searchParam.trim().length > 0)
  const shouldShowFilters = total > 0 || hasActiveFilters

  const view: "list" | "timeline" = isTimelineView ? "timeline" : "list"

  const buildViewHref = (nextView: "list" | "timeline") => {
    const params = new URLSearchParams()
    if (nextView === "list") {
      params.set("page", String(currentPage))
      params.set("pageSize", String(pageSize))
    }

    if (siteTypeFilter) params.set("siteType", siteTypeFilter)
    if (statusFilter) params.set("status", statusFilter)

    if (typeof searchParam === "string" && searchParam.length > 0) params.set("search", searchParam)
    if (searchField !== "guest") params.set("searchBy", searchField)

    if (nextView === "list") {
      params.set("sortBy", sortBy)
      params.set("sortOrder", sortOrder)
    }

    if (nextView === "timeline") {
      params.set("view", "timeline")
      params.set("period", timelinePeriodPreset)
      params.set("periodStart", normalizedPeriodStartYmd)
      params.set("periodEnd", timelinePeriodEndYmd)
    }

    return `/dashboard/${propertyId}/reservations?${params.toString()}`
  }

  const listHref = buildViewHref("list")
  const timelineHref = buildViewHref("timeline")

  return (
    <div className="space-y-4 sm:space-y-6">
      <ReservationsPageHeader
        propertyId={propertyId}
        reservations={reservations}
        currentPage={currentPage}
        total={total}
        siteType={siteTypeFilter ?? null}
        canCreateReservation={reservationPermissions.create}
      />

      <div className="space-y-2">
        <ReservationsViewSwitcher view={view} listHref={listHref} timelineHref={timelineHref} />

        {shouldShowFilters && (
          <ReservationFiltersBar
            propertyId={propertyId}
            allowedSiteTypes={allowedSiteTypes ?? null}
            siteTypesFromDb={siteTypesFromDb}
          />
        )}

        {view === "timeline" ? (
          <ReservationsTimeline
            propertyId={propertyId}
            reservations={reservations}
            sites={timelineSites.map((site) => ({
              id: site.id,
              siteName: site.siteName,
              siteNumber: site.siteNumber,
              siteType: site.siteType,
            }))}
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            siteType={siteTypeFilter ?? null}
            status={statusFilter ?? null}
            searchQuery={typeof searchParam === "string" ? searchParam : null}
            searchField={searchField}
            rateDiscountsConfig={property.rate_discounts_config as RateDiscountsConfig | null}
            bookingRulesConfig={property.booking_rules_config as BookingRulesConfig | null}
            checkInTime={property.check_in_time}
            checkOutTime={property.check_out_time}
            periodPreset={periodPreset}
            periodStartYmd={normalizedPeriodStartYmd}
          />
        ) : (
          <ReservationsTable
            propertyId={propertyId}
            reservations={reservations}
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            siteType={siteTypeFilter ?? null}
            status={statusFilter ?? null}
            searchQuery={typeof searchParam === "string" ? searchParam : null}
            sortBy={sortBy}
            sortOrder={sortOrder}
            searchField={searchField}
            rateDiscountsConfig={property.rate_discounts_config as RateDiscountsConfig | null}
            bookingRulesConfig={property.booking_rules_config as BookingRulesConfig | null}
            checkInTime={property.check_in_time}
            checkOutTime={property.check_out_time}
            canCreateReservation={reservationPermissions.create}
            canModifyReservation={reservationPermissions.modify}
            canCheckInReservation={reservationPermissions.checkIn}
            canCheckOutReservation={reservationPermissions.checkOut}
            canCancelReservation={reservationPermissions.cancel}
          />
        )}
      </div>
    </div>
  )
}

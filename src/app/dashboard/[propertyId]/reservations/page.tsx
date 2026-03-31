import { getReservations, getDistinctSiteTypes, getSites } from "@/lib/dashboard/queries"
import type { ReservationFilters } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import type { BookingRulesConfig, RateDiscountsConfig } from "@/lib/config/types"
import type { ReservationStatus } from "@/contracts/booking"
import { redirect } from "next/navigation"
import { ReservationsTable } from "@/components/dashboard/reservations/reservations-table"
import { ReservationsTimeline } from "@/components/dashboard/reservations/timeline/reservation-timeline"
import { ReservationsViewSwitcher } from "@/components/dashboard/reservations/reservations-view-switcher"
import { ReservationsPageHeader } from "@/components/dashboard/reservations/reservations-page-header"
import { ReservationFilters as ReservationFiltersBar } from "@/components/dashboard/reservations/reservation-filters"
import { LayoutGrid, List } from "lucide-react"

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
          />
        )}
      </div>
    </div>
  )
}

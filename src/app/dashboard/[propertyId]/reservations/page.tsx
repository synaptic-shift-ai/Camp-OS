import { getReservations, getDistinctSiteTypes } from "@/lib/dashboard/queries"
import type { ReservationFilters } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import type { BookingRulesConfig, RateDiscountsConfig } from "@/lib/config/types"
import type { ReservationStatus } from "@/contracts/booking"
import { redirect } from "next/navigation"
import { ReservationsTable } from "@/components/dashboard/reservations/reservations-table"
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
  } =
    await searchParams
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

  const siteTypesFromDb = await getDistinctSiteTypes(propertyId)
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

  const { data: reservations, total } = await getReservations(propertyId, filters, currentPage, pageSize)

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
        <ReservationFiltersBar
          propertyId={propertyId}
          allowedSiteTypes={allowedSiteTypes ?? null}
          siteTypesFromDb={siteTypesFromDb}
        />
        <ReservationsTable
          propertyId={propertyId}
          reservations={reservations}
          currentPage={currentPage}
          pageSize={pageSize}
          total={total}
          siteType={siteTypeFilter ?? null}
          status={statusFilter ?? null}
          searchQuery={typeof searchParam === 'string' ? searchParam : null}
          sortBy={sortBy}
          sortOrder={sortOrder}
          searchField={searchField}
          rateDiscountsConfig={property.rate_discounts_config as RateDiscountsConfig | null}
          bookingRulesConfig={property.booking_rules_config as BookingRulesConfig | null}
          checkInTime={property.check_in_time}
          checkOutTime={property.check_out_time}
        />
      </div>
    </div>
  )
}

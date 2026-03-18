import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getReservations, getDistinctSiteTypes } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import type { BookingRulesConfig, RateDiscountsConfig } from "@/lib/config/types"
import { redirect } from "next/navigation"
import { SiteTypeFilter } from "@/components/dashboard/reservations/site-type-filter"
import { ReservationsTable } from "@/components/dashboard/reservations/reservations-table"
import { ReservationsPageHeader } from "@/components/dashboard/reservations/reservations-page-header"

type PageProps = {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{ siteType?: string; page?: string; pageSize?: string }>
}

export default async function ReservationsPage({ params, searchParams }: PageProps) {
  const { propertyId } = await params
  const { siteType: siteTypeParam, page: pageParam, pageSize: pageSizeParam } =
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
  
  const filters = siteTypeFilter
    ? { siteType: siteTypeFilter }
    : allowedSiteTypes && allowedSiteTypes.length > 0
      ? { allowedSiteTypes  }
      : {}

  const { data: reservations, total } = await getReservations(propertyId, filters, currentPage, pageSize)

  return (
    <div className="space-y-6">
      <ReservationsPageHeader
        propertyId={propertyId}
        reservations={reservations}
        currentPage={currentPage}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Reservations</CardTitle>
              <CardDescription>View and manage your property reservations</CardDescription>
            </div>
            <div>
              <SiteTypeFilter propertyId={propertyId} allowedSiteTypes={allowedSiteTypes ?? null} siteTypesFromDb={siteTypesFromDb} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ReservationsTable
            propertyId={propertyId}
            reservations={reservations}
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            siteType={siteTypeFilter ?? null}
            rateDiscountsConfig={property.rate_discounts_config as RateDiscountsConfig | null}
            bookingRulesConfig={property.booking_rules_config as BookingRulesConfig | null}
          />
        </CardContent>
      </Card>
    </div>
  )
}

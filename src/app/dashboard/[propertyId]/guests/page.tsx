import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDistinctSiteTypes, getGuests } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { redirect } from "next/navigation"
import { GuestsPageHeader } from "@/components/dashboard/guests/guests-page-header"
import { GuestsTable } from "@/components/dashboard/guests/guests-table"
import { GuestFilters } from "@/components/dashboard/guests/guest-filters"

type PageProps = {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
    pageSize?: string
    siteType?: string
    sortBy?: string
    sortOrder?: string
    searchBy?: string
  }>
}

export default async function GuestsPage({ params, searchParams }: PageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const search = await searchParams
  const searchQuery = typeof search.search === "string" ? search.search : undefined
  const searchByParam = typeof search.searchBy === "string" ? search.searchBy : undefined
  const searchField =
    searchByParam === "name" || searchByParam === "email" ? searchByParam : "name"
  const siteTypeParam = typeof search.siteType === "string" ? search.siteType : undefined
  const siteType = siteTypeParam && siteTypeParam !== "all" ? siteTypeParam : undefined
  const sortByParam = typeof search.sortBy === "string" ? search.sortBy : undefined
  const sortOrderParam = typeof search.sortOrder === "string" ? search.sortOrder : undefined
  const sortBy =
    sortByParam === "guest" ||
      sortByParam === "totalStays" ||
      sortByParam === "totalSpent" ||
      sortByParam === "lastVisit"
      ? sortByParam
      : "totalSpent"
  const sortOrder = sortOrderParam === "asc" || sortOrderParam === "desc" ? sortOrderParam : "desc"
  const pageParam = search.page
  const currentPage =
    Number.isNaN(Number(pageParam)) || !pageParam ? 1 : Math.max(1, Number(pageParam))
  const pageSizeParam = typeof search.pageSize === "string" ? search.pageSize : undefined
  const parsedPageSize =
    Number.isNaN(Number(pageSizeParam)) || !pageSizeParam
      ? undefined
      : Number(pageSizeParam)
  const pageSize = parsedPageSize && parsedPageSize > 0 ? parsedPageSize : 10
  const rawSiteTypeConfig = (property as { site_type_config?: { allowed_site_types?: string[] } } | null)
    ?.site_type_config ?? null
  const allowedSiteTypes =
    Array.isArray(rawSiteTypeConfig?.allowed_site_types) && rawSiteTypeConfig.allowed_site_types.length > 0
      ? rawSiteTypeConfig.allowed_site_types.map((type) => type.toLowerCase())
      : null

  const siteTypesFromDb = await getDistinctSiteTypes(propertyId)

  const guestsFilters: {
    search: string | undefined
    siteType?: string
    allowedSiteTypes?: string[]
    sortBy: "guest" | "totalStays" | "totalSpent" | "lastVisit"
    sortOrder: "asc" | "desc"
    searchField: "name" | "email"
  } = {
    search: searchQuery,
    sortBy,
    sortOrder,
    searchField,
  }
  if (siteType) guestsFilters.siteType = siteType
  if (allowedSiteTypes) guestsFilters.allowedSiteTypes = allowedSiteTypes

  const { data: guests, total } = await getGuests(
    propertyId,
    guestsFilters,
    currentPage,
    pageSize
  )

  return (
    <div className="space-y-6">
      <GuestsPageHeader
        propertyId={propertyId}
        guests={guests}
        currentPage={currentPage}
        total={total}
        searchQuery={searchQuery ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>All Guests</CardTitle>
          <CardDescription>View and manage your guest information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <GuestFilters
              propertyId={propertyId}
              siteTypes={siteTypesFromDb}
              allowedSiteTypes={allowedSiteTypes}
            />
            <GuestsTable
              propertyId={propertyId}
              guests={guests}
              currentPage={currentPage}
              pageSize={pageSize}
              total={total}
              searchQuery={searchQuery ?? null}
              siteType={siteType ?? null}
              sortBy={sortBy}
              sortOrder={sortOrder}
              searchField={searchField}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

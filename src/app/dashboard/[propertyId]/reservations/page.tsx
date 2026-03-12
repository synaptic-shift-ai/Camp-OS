import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { getReservations, getDistinctSiteTypes } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { redirect } from "next/navigation"
import { SiteTypeFilter } from "@/components/dashboard/reservations/site-type-filter"
import { ReservationsTable } from "@/components/dashboard/reservations/reservations-table"

type PageProps = {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{ siteType?: string; page?: string }>
}

export default async function ReservationsPage({ params, searchParams }: PageProps) {
  const { propertyId } = await params
  const { siteType: siteTypeParam, page: pageParam } = await searchParams
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const currentPage = Number.isNaN(Number(pageParam)) || !pageParam ? 1 : Math.max(1, Number(pageParam))
  const pageSize = 10

  const siteTypesFromDb = await getDistinctSiteTypes(propertyId)
  const siteTypeFilter = siteTypeParam && siteTypeParam !== 'all' ? siteTypeParam : undefined
  const filters = siteTypeFilter ? { siteType: siteTypeFilter } : {}
  const { data: reservations, total } = await getReservations(propertyId, filters, currentPage, pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Reservations</h1>
          <p className="text-muted-foreground">Manage all your property bookings</p>
        </div>
        <Link href={`/dashboard/${propertyId}/reservations/new`}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Reservation
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Reservations</CardTitle>
              <CardDescription>View and manage your property reservations</CardDescription>
            </div>
            <div>
              <SiteTypeFilter propertyId={propertyId} siteTypesFromDb={siteTypesFromDb} />
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
          />
        </CardContent>
      </Card>
    </div>
  )
}

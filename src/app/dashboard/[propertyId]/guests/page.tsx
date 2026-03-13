import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getGuests } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { redirect } from "next/navigation"
import { GuestsPageHeader } from "@/components/dashboard/guests/guests-page-header"
import { GuestsTable } from "@/components/dashboard/guests/guests-table"

type PageProps = {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function GuestsPage({ params, searchParams }: PageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const search = await searchParams
  const searchQuery = typeof search.search === "string" ? search.search : undefined
  const pageParam = search.page
  const currentPage =
    Number.isNaN(Number(pageParam)) || !pageParam ? 1 : Math.max(1, Number(pageParam))
  const pageSize = 10

  const { data: guests, total } = await getGuests(
    propertyId,
    { search: searchQuery },
    currentPage,
    pageSize
  )

  return (
    <div className="space-y-6">
      <GuestsPageHeader propertyId={propertyId} />

      <Card>
        <CardHeader>
          <CardTitle>All Guests</CardTitle>
          <CardDescription>View and manage your guest information</CardDescription>
        </CardHeader>
        <CardContent>
          <GuestsTable
            propertyId={propertyId}
            guests={guests}
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            searchQuery={searchQuery ?? null}
          />
        </CardContent>
      </Card>
    </div>
  )
}

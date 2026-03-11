import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Mail, Phone } from "lucide-react"
import { getGuests } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { redirect } from "next/navigation"
import { GuestsPageHeader } from "@/components/dashboard/guests/guests-page-header"
import { GuestActions } from "@/components/dashboard/guests/guest-actions"

/**
 * Format money from integer cents to dollar display
 */
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

interface GuestsListProps {
  propertyId: string
  searchQuery: string | undefined
}

async function GuestsList({ propertyId, searchQuery }: GuestsListProps) {

  if (!propertyId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No property found. Please contact support.</p>
      </div>
    )
  }

  // Fetch guests with optional search filter
  const { data: guests } = await getGuests(propertyId, {
    search: searchQuery,
  })

  if (guests.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {searchQuery ? "No guests found matching your search." : "No guests yet. Your first reservation will appear here!"}
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Total Stays</TableHead>
          <TableHead>Total Spent</TableHead>
          <TableHead>Last Visit</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {guests.map((guest) => (
          <TableRow key={guest.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={`/generic-placeholder-graphic.png?height=40&width=40`} />
                  <AvatarFallback>
                    {guest.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{guest.name}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  {guest.email}
                </div>
                {guest.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {guest.phone}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>{guest.totalStays}</TableCell>
            <TableCell>{formatMoney(guest.totalSpent)}</TableCell>
            <TableCell>
              {guest.lastVisit
                ? new Date(guest.lastVisit).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
                : 'N/A'}
            </TableCell>
            <TableCell>
              <GuestActions guest={guest} propertyId={propertyId} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

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

  return (
    <div className="space-y-6">
      <GuestsPageHeader propertyId={propertyId} />

      <Card>
        <CardHeader>
          <CardTitle>All Guests</CardTitle>
          <CardDescription>View and manage your guest information</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading guests...</p>
              </div>
            }
          >
            <GuestsList propertyId={propertyId} searchQuery={searchQuery} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

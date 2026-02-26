import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Mail, MoreVertical, Phone } from "lucide-react"
import { getGuests } from "@/lib/dashboard/queries"
import { createClient } from "@/lib/supabase/server"
import { GuestsPageHeader } from "@/components/dashboard/guests/guests-page-header"

/**
 * Format money from integer cents to dollar display
 */
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/**
 * Get the current user's property ID
 * MVP: Assumes user has access to one property
 */
async function getCurrentPropertyId(): Promise<string | null> {
  const supabase = await createClient()

  // Get the currently authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get the first property owned by this user
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  return property?.id || null
}

interface GuestsListProps {
  searchQuery: string | undefined
}

async function GuestsList({ searchQuery }: GuestsListProps) {
  const propertyId = await getCurrentPropertyId()

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>View Profile</DropdownMenuItem>
                  <DropdownMenuItem>Edit Guest</DropdownMenuItem>
                  <DropdownMenuItem>View Reservations</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">Delete Guest</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface GuestsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function GuestsPage({ searchParams }: GuestsPageProps) {
  const params = await searchParams
  const searchQuery = typeof params.search === 'string' ? params.search : undefined
  const propertyId = await getCurrentPropertyId()

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
            <GuestsList searchQuery={searchQuery} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

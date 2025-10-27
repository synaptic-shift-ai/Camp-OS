import { Suspense } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {Plus, MoreVertical } from "lucide-react"
import { getReservations } from "@/lib/dashboard/queries"
import type { ReservationStatus } from "@/src/contracts/booking"
import { createClient } from "@/lib/supabase/server"
import { CancelReservationDialog } from "@/components/admin/cancel-reservation-dialog"

const statusColors: Record<ReservationStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  checked_in: "bg-green-500/10 text-green-500 border-green-500/20",
  checked_out: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  no_show: "bg-orange-500/10 text-orange-500 border-orange-500/20",
}

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
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

async function ReservationsTable() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No property found. Please contact support.</p>
      </div>
    )
  }

  // Fetch all reservations for this property
  const { data: reservations, total } = await getReservations(propertyId, {}, 1, 100)

  if (reservations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No reservations yet. Create your first booking!</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Confirmation</TableHead>
          <TableHead>Guest</TableHead>
          <TableHead>Site</TableHead>
          <TableHead>Check-in</TableHead>
          <TableHead>Check-out</TableHead>
          <TableHead>Nights</TableHead>
          <TableHead>Guests</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reservations.map((reservation) => (
          <TableRow key={reservation.id}>
            <TableCell className="font-medium">{reservation.confirmationNumber}</TableCell>
            <TableCell>{reservation.guestName}</TableCell>
            <TableCell>{reservation.siteName}</TableCell>
            <TableCell>{formatDate(reservation.checkIn)}</TableCell>
            <TableCell>{formatDate(reservation.checkOut)}</TableCell>
            <TableCell>{reservation.numNights}</TableCell>
            <TableCell>{reservation.numAdults + reservation.numChildren}</TableCell>
            <TableCell>{formatMoney(reservation.totalAmount)}</TableCell>
            <TableCell>
              <Badge variant="outline" className={statusColors[reservation.status]}>
                {reservation.status.replace("_", " ")}
              </Badge>
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
                  <DropdownMenuItem>View Details</DropdownMenuItem>
                  <DropdownMenuItem>Edit Reservation</DropdownMenuItem>
                  <DropdownMenuItem>Send Confirmation</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <CancelReservationDialog
                    reservationId={reservation.id}
                    confirmationNumber={reservation.confirmationNumber}
                    guestName={reservation.guestName}
                    trigger={
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={(e) => e.preventDefault()}
                      >
                        Cancel Reservation
                      </DropdownMenuItem>
                    }
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default async function ReservationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Reservations</h1>
          <p className="text-muted-foreground">Manage all your property bookings</p>
        </div>
        <Link href="/dashboard/reservations/new">
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
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading reservations...</p>
            </div>
          }>
            <ReservationsTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

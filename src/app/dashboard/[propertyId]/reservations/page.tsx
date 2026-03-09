import { Suspense } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus } from "lucide-react"
import { getReservations } from "@/lib/dashboard/queries"
import type { ReservationStatus } from "@/contracts/booking"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { redirect } from "next/navigation"
import { ReservationActions } from "@/components/admin/reservation-actions"

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

async function ReservationsTable({ propertyId }: { propertyId: string }) {

  if (!propertyId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No property found. Please contact support.</p>
      </div>
    )
  }

  // Fetch all reservations for this property
  const { data: reservations } = await getReservations(propertyId, {}, 1, 100)

  if (reservations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No reservations yet. Create your first booking!</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-260px)] overflow-y-auto">
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
            <TableHead>Total Amount</TableHead>
            <TableHead>Paid Amount</TableHead>
            <TableHead>Refund</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((reservation) => {
            const amountDueCents = Math.max(0, reservation.totalAmount - reservation.paidAmount)
            const balanceCents = Math.max(
              0,
              reservation.totalAmount - reservation.paidAmount
            )
            const hasOutstandingBalance = amountDueCents > 0

            const canRefund = 
              reservation.status === 'cancelled' && 
              reservation.paidAmount > 0 &&
              reservation.refundAmount < reservation.paidAmount

            const maxRefundableCents = Math.max(
              0,
              reservation.paidAmount - reservation.refundAmount
            )

            return (
              <TableRow key={reservation.id}>
                <TableCell className="font-medium">{reservation.confirmationNumber}</TableCell>
                <TableCell>{reservation.guestName}</TableCell>
                <TableCell>{reservation.siteName}</TableCell>
                <TableCell>{formatDate(reservation.checkIn)}</TableCell>
                <TableCell>{formatDate(reservation.checkOut)}</TableCell>
                <TableCell>{reservation.numNights}</TableCell>
                <TableCell>{reservation.numAdults + reservation.numChildren}</TableCell>
                <TableCell>{formatMoney(reservation.totalAmount)}</TableCell>
                <TableCell>{formatMoney(reservation.paidAmount)}</TableCell>
                <TableCell>{formatMoney(reservation.refundAmount)}</TableCell>
                <TableCell>{formatMoney(balanceCents)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[reservation.status]}>
                    {reservation.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ReservationActions
                    reservationId={reservation.id}
                    confirmationNumber={reservation.confirmationNumber}
                    guestName={reservation.guestName}
                    status={reservation.status}
                    checkIn={reservation.checkIn}
                    checkOut={reservation.checkOut}
                    numAdults={reservation.numAdults}
                    numChildren={reservation.numChildren}
                    numPets={reservation.numPets}
                    siteNumber={reservation.siteNumber}
                    siteName={reservation.siteName}
                    pricePerNight={reservation.pricePerNight}
                    weeklyRateCents={reservation.weeklyRateCents ?? null}
                    monthlyRateCents={reservation.monthlyRateCents ?? null}
                    bookingType={reservation.bookingType}
                    totalAmount={reservation.totalAmount}
                    paidAmount={reservation.paidAmount}
                    hasOutstandingBalance={hasOutstandingBalance}
                    canRefund={canRefund}
                    maxRefundableCents={maxRefundableCents}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

type PageProps = { params: Promise<{ propertyId: string }> }

export default async function ReservationsPage({ params }: PageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

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
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading reservations...</p>
            </div>
          }>
            <ReservationsTable propertyId={propertyId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ReservationActions } from "@/components/admin/reservation-actions"
import { Pagination } from "@/components/ui/pagination"
import type { ReservationStatus } from "@/contracts/booking"
import type { DashboardReservation } from "@/lib/dashboard/queries"

const statusTextColors: Record<ReservationStatus, string> = {
  pending: "text-yellow-600",
  confirmed: "text-blue-600",
  checked_in: "text-green-600",
  checked_out: "text-gray-600",
  cancelled: "text-red-600",
  no_show: "text-orange-600",
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

type ReservationsTableProps = {
  propertyId: string
  reservations: DashboardReservation[]
  currentPage: number
  pageSize: number
  total: number
  siteType: string | null
}

export function ReservationsTable({
  propertyId,
  reservations,
  currentPage,
  pageSize,
  total,
  siteType,
}: ReservationsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedReservation, setSelectedReservation] = useState<DashboardReservation | null>(null)

  const goToPage = (page: number) => {
    startTransition(() => {
      router.push(buildPageHref(page))
    })
  }

  if (!reservations.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No reservations found for this view.
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clampedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
  const startIndex = (clampedCurrentPage - 1) * pageSize + 1
  const endIndex = Math.min(total, clampedCurrentPage * pageSize)

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams()
    params.set("page", String(page))
    if (siteType) {
      params.set("siteType", siteType)
    }
    return `/dashboard/${propertyId}/reservations?${params.toString()}`
  }

  return (
    <>
      <div className="relative">
        {isPending && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-background/60"
            aria-busy="true"
            aria-label="Loading reservations"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div className="max-h-[calc(100vh-260px)] overflow-y-auto border rounded-md">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="h-8">
                <TableHead className="py-1.5">Confirmation</TableHead>
                <TableHead className="py-1.5">Guest</TableHead>
                <TableHead className="py-1.5">Site</TableHead>
                <TableHead className="py-1.5">Check-in</TableHead>
                <TableHead className="py-1.5">Check-out</TableHead>
                <TableHead className="py-1.5">Nights</TableHead>
                <TableHead className="py-1.5">Guests</TableHead>
                <TableHead className="py-1.5">Total</TableHead>
                <TableHead className="py-1.5">Paid</TableHead>
                <TableHead className="py-1.5">Balance</TableHead>
                <TableHead className="py-1.5">Refunded</TableHead>
                <TableHead className="py-1.5">Status</TableHead>
                <TableHead className="w-10 py-1.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => {
                const amountDueCents = Math.max(
                  0,
                  reservation.totalAmount - reservation.paidAmount
                )
                const balanceCents = Math.max(
                  0,
                  reservation.totalAmount - reservation.paidAmount
                )
                const hasOutstandingBalance = amountDueCents > 0

                const canRefund =
                  reservation.status === "cancelled" &&
                  reservation.paidAmount > 0 &&
                  reservation.refundAmount < reservation.paidAmount

                const maxRefundableCents = Math.max(
                  0,
                  reservation.paidAmount - reservation.refundAmount
                )

                return (
                  <TableRow
                    key={reservation.id}
                    className="h-8 cursor-pointer hover:bg-muted/60"
                    onClick={() => setSelectedReservation(reservation)}
                  >
                    <TableCell className="py-1.5 font-medium whitespace-nowrap">
                      {reservation.confirmationNumber}
                    </TableCell>
                    <TableCell className="py-1.5 whitespace-nowrap">
                      {reservation.guestName}
                    </TableCell>
                    <TableCell className="py-1.5 whitespace-nowrap">
                      {reservation.siteName}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {formatDate(reservation.checkIn)}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {formatDate(reservation.checkOut)}
                    </TableCell>
                    <TableCell className="py-1.5">{reservation.numNights}</TableCell>
                    <TableCell className="py-1.5">
                      {reservation.numAdults + reservation.numChildren}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {formatMoney(reservation.totalAmount)}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {formatMoney(reservation.paidAmount)}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {formatMoney(balanceCents)}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {formatMoney(reservation.refundAmount)}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <span
                        className={`${statusTextColors[reservation.status]} whitespace-nowrap text-xs font-medium capitalize`}
                      >
                        {reservation.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell
                      className="py-0.5"
                      onClick={(event) => {
                        event.stopPropagation()
                      }}
                    >
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
                        specialRequests={reservation.specialRequests}
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
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium">
            {startIndex}–{endIndex}
          </span>{" "}
          of <span className="font-medium">{total}</span> reservations
        </div>
        <Pagination
          currentPage={clampedCurrentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          disabled={isPending}
          windowSize={4}
        />
      </div>

      <Dialog
        open={!!selectedReservation}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReservation(null)
          }
        }}
      >
        <DialogContent className="max-w-xl">
          {selectedReservation && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Reservation {selectedReservation.confirmationNumber}
                </DialogTitle>
                <DialogDescription>
                  Detailed information for {selectedReservation.guestName}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-3 space-y-6 text-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      Guest
                    </div>
                    <div className="mt-1 font-medium">
                      {selectedReservation.guestName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedReservation.guestEmail}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      Site
                    </div>
                    <div className="mt-1 font-medium">
                      {selectedReservation.siteName}{" "}
                      {selectedReservation.siteNumber &&
                        `(#${selectedReservation.siteNumber})`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedReservation.bookingType.replace("_", " ")}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      Stay
                    </div>
                    <div className="mt-1 font-medium">
                      {formatDate(selectedReservation.checkIn)} –{" "}
                      {formatDate(selectedReservation.checkOut)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedReservation.numNights} nights •{" "}
                      {selectedReservation.numAdults +
                        selectedReservation.numChildren}{" "}
                      guests • {selectedReservation.numPets} pets
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Status
                      </div>
                      <span
                        className={`${statusTextColors[selectedReservation.status]} shrink-0 whitespace-nowrap text-xs font-medium capitalize`}
                      >
                        {selectedReservation.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">Booked</span>{" "}
                      {formatDate(selectedReservation.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Financials
                  </div>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">Total</dt>
                      <dd className="font-medium">
                        {formatMoney(selectedReservation.totalAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Paid</dt>
                      <dd className="font-medium">
                        {formatMoney(selectedReservation.paidAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Refunded
                      </dt>
                      <dd className="font-medium">
                        {formatMoney(selectedReservation.refundAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Balance
                      </dt>
                      <dd className="font-medium">
                        {formatMoney(
                          Math.max(
                            0,
                            selectedReservation.totalAmount -
                            selectedReservation.paidAmount
                          )
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-4">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      Guest special requests
                    </div>
                    <div className="mt-1.5 whitespace-pre-wrap text-sm">
                      {selectedReservation.specialRequests?.trim() || "None"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      Check-in notes
                    </div>
                    <div className="mt-1.5 whitespace-pre-wrap text-sm">
                      {selectedReservation.checkInNotes?.trim() || "None"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}


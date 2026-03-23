"use client"

import { useEffect, useState, useTransition } from "react"
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
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import type { ReservationStatus } from "@/contracts/booking"
import type { DashboardReservation } from "@/lib/dashboard/queries"
import type { BookingRulesConfig, RateDiscountsConfig } from "@/lib/config/types"
import {
  AmericanExpressFlatRoundedIcon,
  DiscoverFlatRoundedIcon,
  GenericFlatRoundedIcon,
  MastercardFlatRoundedIcon,
  VisaFlatRoundedIcon,
} from "react-svg-credit-card-payment-icons"

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

type PaymentCardDisplay = {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

function PaymentCardLogo({ brand }: { brand: string }) {
  const normalized = brand.trim().toLowerCase()
  switch (normalized) {
    case "visa":
      return <VisaFlatRoundedIcon width={56} />
    case "mastercard":
      return <MastercardFlatRoundedIcon width={56} />
    case "amex":
    case "american express":
    case "americanexpress":
      return <AmericanExpressFlatRoundedIcon width={56} />
    case "discover":
      return <DiscoverFlatRoundedIcon width={56} />
    default:
      return <GenericFlatRoundedIcon width={56} />
  }
}

type ReservationsTableProps = {
  propertyId: string
  reservations: DashboardReservation[]
  currentPage: number
  pageSize: number
  total: number
  siteType: string | null
  status: ReservationStatus | null
  searchQuery: string | null
  sortBy:
  | 'confirmation'
  | 'guest'
  | 'site'
  | 'checkIn'
  | 'checkOut'
  | 'nights'
  | 'guests'
  | 'totalAmount'
  | 'paidAmount'
  | 'balanceOwed'
  | 'refundedAmount'
  | 'status'
  sortOrder: 'asc' | 'desc'
  searchField: 'confirmation' | 'guest' | 'site'
  rateDiscountsConfig?: RateDiscountsConfig | null | undefined
  bookingRulesConfig?: BookingRulesConfig | null | undefined
  checkInTime?: string | null
  checkOutTime?: string | null
}

export function ReservationsTable({
  propertyId,
  reservations,
  currentPage,
  pageSize,
  total,
  siteType,
  status,
  searchQuery,
  sortBy,
  sortOrder,
  searchField,
  rateDiscountsConfig,
  bookingRulesConfig,
  checkInTime,
  checkOutTime,
}: ReservationsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isExternalLoading, setIsExternalLoading] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<DashboardReservation | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [paymentCard, setPaymentCard] = useState<PaymentCardDisplay | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleLoadingStart = () => setIsExternalLoading(true)
    window.addEventListener("dashboard-table-loading-start", handleLoadingStart)
    return () => window.removeEventListener("dashboard-table-loading-start", handleLoadingStart)
  }, [])

  useEffect(() => {
    setIsExternalLoading(false)
  }, [reservations, currentPage, pageSize, total])

  useEffect(() => {
    if (!selectedReservation?.id) return

    let cancelled = false
    setPreviewLoading(true)
    setPaymentCard(null)
    setPaymentMethod(null)

    fetch(`/api/v1/reservations/${selectedReservation.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        const method = json?.data?.payment_method
        if (typeof method === "string" && method.length > 0) {
          setPaymentMethod(method)
        }
        const pc = json?.data?.payment_card
        if (
          json?.success === true &&
          pc &&
          typeof pc.last4 === "string" &&
          typeof pc.brand === "string" &&
          typeof pc.exp_month === "number" &&
          typeof pc.exp_year === "number"
        ) {
          setPaymentCard({
            brand: pc.brand,
            last4: pc.last4,
            exp_month: pc.exp_month,
            exp_year: pc.exp_year,
          })
        }
      })
      .catch(() => {
        // Keep paymentCard null
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedReservation?.id])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clampedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
  const startIndex = (clampedCurrentPage - 1) * pageSize + 1
  const endIndex = Math.min(total, clampedCurrentPage * pageSize)

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))
    if (siteType) {
      params.set("siteType", siteType)
    }
    if (status) {
      params.set("status", status)
    }
    if (searchQuery) {
      params.set("search", searchQuery)
    }
    if (searchField !== "guest") {
      params.set("searchBy", searchField)
    }
    params.set("sortBy", sortBy)
    params.set("sortOrder", sortOrder)
    return `/dashboard/${propertyId}/reservations?${params.toString()}`
  }

  const goToPage = (page: number) => {
    startTransition(() => {
      router.push(buildPageHref(page))
    })
  }

  const handlePageSizeChange = (nextPageSize: number) => {
    startTransition(() => {
      const params = new URLSearchParams()
      params.set("page", "1")
      params.set("pageSize", String(nextPageSize))
      if (siteType) {
        params.set("siteType", siteType)
      }
      if (status) {
        params.set("status", status)
      }
      if (searchQuery) {
        params.set("search", searchQuery)
      }
      if (searchField !== "guest") {
        params.set("searchBy", searchField)
      }
      params.set("sortBy", sortBy)
      params.set("sortOrder", sortOrder)
      router.push(`/dashboard/${propertyId}/reservations?${params.toString()}`)
    })
  }

  if (!reservations.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No reservations found for this view.
      </div>
    )
  }

  return (
    <>
      <div className="relative">
        {(isPending || isExternalLoading) && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-background/60"
            aria-busy="true"
            aria-label="Loading reservations"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div className="border rounded-md">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="h-8">
                <TableHead className="py-1.5">Confirmation</TableHead>
                <TableHead className="py-1.5">Primary Guest</TableHead>
                <TableHead className="py-1.5">Site</TableHead>
                <TableHead className="py-1.5">Check-in</TableHead>
                <TableHead className="py-1.5">Check-out</TableHead>
                <TableHead className="py-1.5">Nights</TableHead>
                <TableHead className="py-1.5">Total Guests</TableHead>
                <TableHead className="py-1.5">Total Amount</TableHead>
                <TableHead className="py-1.5">Paid Amount</TableHead>
                <TableHead className="py-1.5">Balance Owed</TableHead>
                <TableHead className="py-1.5">Refunded Amount</TableHead>
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
                    <TableCell className="py-1.5 whitespace-nowrap capitalize">
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
                        rateDiscountsConfig={rateDiscountsConfig}
                        blackoutDates={bookingRulesConfig?.blackout_dates ?? []}
                        allowedCheckInDays={bookingRulesConfig?.allowed_checkin_days ?? []}
                        allowedCheckOutDays={bookingRulesConfig?.allowed_checkout_days ?? []}
                        checkInTime={checkInTime}
                        checkOutTime={checkOutTime}
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
        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
          <div>
            Showing{" "}
            <span className="font-medium">
              {startIndex}–{endIndex}
            </span>{" "}
            of <span className="font-medium">{total}</span> reservations
          </div>
          <PageSizeSelector
            value={pageSize}
            onChange={handlePageSizeChange}
            disabled={isPending}
          />
        </div>
        <Pagination
          currentPage={clampedCurrentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          disabled={isPending}
          windowSize={2}
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
                <DialogDescription className="capitalize">
                  Detailed information for {selectedReservation.guestName}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-3 space-y-6 text-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      Primary Guest
                    </div>
                    <div className="mt-1 font-medium capitalize">
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
                    Payment Method
                  </div>
                  <div className="mt-1 font-medium">
                    {paymentMethod ?? "—"}
                  </div>
                  {previewLoading ? (
                    <div className="mt-2 text-xs text-muted-foreground">Loading card…</div>
                  ) : paymentCard ? (
                    <div className="mt-2 inline-flex items-center gap-3 align-middle">
                      <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center">
                        <PaymentCardLogo brand={paymentCard.brand} />
                      </span>
                      <span className="font-mono text-base text-foreground">
                        **** **** **** {paymentCard.last4}
                      </span>
                    </div>
                  ) : null}
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


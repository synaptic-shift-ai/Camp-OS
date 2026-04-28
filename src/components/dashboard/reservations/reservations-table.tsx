"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, CalendarPlus2, Moon, Users } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ReservationActions } from "@/components/admin/reservation-actions"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { Button } from "@/components/ui/button"
import type { ReservationStatus } from "@/contracts/booking"
import type { DashboardGuest, DashboardReservation } from "@/lib/dashboard/queries"
import { GuestReservationsSheet } from "@/components/dashboard/guests/guest-reservations-sheet"
import { ReservationDetailDialog } from "@/components/dashboard/reservations/reservation-detail-dialog"
import type { BookingRulesConfig, RateDiscountsConfig } from "@/lib/config/types"

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
  canCreateReservation: boolean
  canModifyReservation: boolean
  canCheckInReservation: boolean
  canCheckOutReservation: boolean
  canCancelReservation: boolean
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
  canCreateReservation,
  canModifyReservation,
  canCheckInReservation,
  canCheckOutReservation,
  canCancelReservation,
}: ReservationsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isExternalLoading, setIsExternalLoading] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<DashboardReservation | null>(null)
  const [guestSheetGuest, setGuestSheetGuest] = useState<DashboardGuest | null>(null)

  function openReservationDialog(reservation: DashboardReservation) {
    setGuestSheetGuest(null)
    setSelectedReservation(reservation)
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleLoadingStart = () => setIsExternalLoading(true)
    window.addEventListener("dashboard-table-loading-start", handleLoadingStart)
    return () => window.removeEventListener("dashboard-table-loading-start", handleLoadingStart)
  }, [])

  useEffect(() => {
    setIsExternalLoading(false)
  }, [reservations, currentPage, pageSize, total])

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

  const getDefaultSortOrder = (
    column:
      | "confirmation"
      | "guest"
      | "site"
      | "checkIn"
      | "checkOut"
      | "nights"
      | "guests"
      | "totalAmount"
      | "paidAmount"
      | "balanceOwed"
      | "refundedAmount"
      | "status"
  ): "asc" | "desc" => {
    if (
      column === "checkIn" ||
      column === "checkOut" ||
      column === "nights" ||
      column === "guests" ||
      column === "totalAmount" ||
      column === "paidAmount" ||
      column === "balanceOwed" ||
      column === "refundedAmount"
    ) {
      return "desc"
    }
    return "asc"
  }

  const handleSort = (
    column:
      | "confirmation"
      | "guest"
      | "site"
      | "checkIn"
      | "checkOut"
      | "nights"
      | "guests"
      | "totalAmount"
      | "paidAmount"
      | "balanceOwed"
      | "refundedAmount"
      | "status"
  ) => {
    const nextSortOrder =
      sortBy === column ? (sortOrder === "asc" ? "desc" : "asc") : getDefaultSortOrder(column)

    startTransition(() => {
      const params = new URLSearchParams()
      params.set("page", "1")
      params.set("pageSize", String(pageSize))
      if (siteType) params.set("siteType", siteType)
      if (status) params.set("status", status)
      if (searchQuery) params.set("search", searchQuery)
      if (searchField !== "guest") params.set("searchBy", searchField)
      params.set("sortBy", column)
      params.set("sortOrder", nextSortOrder)
      router.push(`/dashboard/${propertyId}/reservations?${params.toString()}`)
    })
  }

  const SortIcon = ({ column }: { column: ReservationsTableProps["sortBy"] }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3.5 w-3.5" />
    return sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  if (!reservations.length) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center min-h-[calc(100vh-14rem)] flex items-center justify-center">
        <div>
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarDays className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            You're all set - no reservations yet
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            Once guests book a stay, their reservation details will appear here.
          </p>
          {canCreateReservation && (
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => router.push(`/dashboard/${propertyId}/reservations/new`)}>
                <CalendarPlus2 className="mr-2 h-4 w-4" />
                Create reservation
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="relative">
        {(isPending || isExternalLoading) && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/60"
            aria-busy="true"
            aria-label="Loading reservations"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div className="space-y-2 md:hidden">
          {reservations.map((reservation) => {
            const amountDueCents = Math.max(
              0,
              reservation.totalAmount - reservation.paidAmount
            )
            const hasOutstandingBalance = amountDueCents > 0

            const canRefund =
              (reservation.status === "cancelled" || reservation.status === "confirmed") &&
              reservation.paidAmount > 0 &&
              reservation.refundAmount < reservation.paidAmount

            const maxRefundableCents = Math.max(
              0,
              reservation.paidAmount - reservation.refundAmount
            )

            return (
              <div
                key={reservation.id}
                className="rounded-md border border-border/80 bg-card/50 p-3"
                onClick={() => openReservationDialog(reservation)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold capitalize leading-tight">
                      {reservation.guestName}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{reservation.siteName}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <p className="text-2xl font-semibold leading-none">
                        {formatMoney(reservation.totalAmount)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Paid {formatMoney(reservation.paidAmount)}
                      </p>
                    </div>
                    <div
                      className="-mt-0.5"
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
                        canModify={canModifyReservation}
                        canCheckIn={canCheckInReservation}
                        canCheckOut={canCheckOutReservation}
                        canCancel={canCancelReservation}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {reservation.confirmationNumber}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(reservation.checkIn)} - {formatDate(reservation.checkOut)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Moon className="h-3.5 w-3.5" />
                    {reservation.numNights} {reservation.numNights === 1 ? "Night" : "Nights"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {reservation.numAdults + reservation.numChildren}{" "}
                    {reservation.numAdults + reservation.numChildren === 1 ? "Guest" : "Guests"}
                  </span>
                </div>
                <div className="mt-2 flex items-start gap-4 border-t border-border/70 pt-2 text-xs">
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">Status</p>
                    <p
                      className={`${statusTextColors[reservation.status]} mt-0.5 whitespace-nowrap font-semibold uppercase`}
                    >
                      {reservation.status.replace("_", " ")}
                    </p>
                  </div>
                  {amountDueCents > 0 && (
                    <div>
                      <p className="uppercase tracking-wide text-muted-foreground">Balance Owed</p>
                      <p className="mt-0.5 font-semibold">{formatMoney(amountDueCents)}</p>
                    </div>
                  )}
                  {reservation.refundAmount > 0 && (
                    <div>
                      <p className="uppercase tracking-wide text-muted-foreground">Refunded</p>
                      <p className="mt-0.5 font-semibold">{formatMoney(reservation.refundAmount)}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="hidden border border-border/80 bg-card/50 md:block">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
              <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("confirmation")}>
                    Confirmation
                    <SortIcon column="confirmation" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("guest")}>
                    Primary Guest
                    <SortIcon column="guest" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("site")}>
                    Site
                    <SortIcon column="site" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("checkIn")}>
                    Check-in
                    <SortIcon column="checkIn" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("checkOut")}>
                    Check-out
                    <SortIcon column="checkOut" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("nights")}>
                    Nights
                    <SortIcon column="nights" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("guests")}>
                    Total Guests
                    <SortIcon column="guests" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("totalAmount")}>
                    Total Amount
                    <SortIcon column="totalAmount" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("paidAmount")}>
                    Paid Amount
                    <SortIcon column="paidAmount" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("balanceOwed")}>
                    Balance Owed
                    <SortIcon column="balanceOwed" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("refundedAmount")}>
                    Refunded Amount
                    <SortIcon column="refundedAmount" />
                  </button>
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort("status")}>
                    Status
                    <SortIcon column="status" />
                  </button>
                </TableHead>
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
                  (reservation.status === "cancelled" || reservation.status === "confirmed") &&
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
                    onClick={() => openReservationDialog(reservation)}
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
                        canModify={canModifyReservation}
                        canCheckIn={canCheckInReservation}
                        canCheckOut={canCheckOutReservation}
                        canCancel={canCancelReservation}
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
        <div className="flex w-full flex-col items-center gap-2 text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-4">
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
        <div className="flex w-full justify-center sm:w-auto sm:justify-end">
          <Pagination
            currentPage={clampedCurrentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            disabled={isPending}
            windowSize={2}
          />
        </div>
      </div>

      <ReservationDetailDialog
        open={!!selectedReservation}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReservation(null)
            setGuestSheetGuest(null)
          }
        }}
        reservation={selectedReservation}
        onPrimaryGuestClick={(guest) => setGuestSheetGuest(guest)}
        canModify={canModifyReservation}
        canCheckIn={canCheckInReservation}
        canCheckOut={canCheckOutReservation}
        canCancel={canCancelReservation}
      />

      {guestSheetGuest && (
        <GuestReservationsSheet
          open
          onOpenChange={(open) => {
            if (!open) setGuestSheetGuest(null)
          }}
          guest={guestSheetGuest}
          propertyId={propertyId}
          disableReservationDetailFromSheet
        />
      )}
    </>
  )
}


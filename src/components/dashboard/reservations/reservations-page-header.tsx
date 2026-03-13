"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { DashboardReservation } from "@/lib/dashboard/queries"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"
import { ExportMenu } from "@/components/ui/export-menu"

type ReservationsPageHeaderProps = {
  propertyId: string
  reservations: DashboardReservation[]
  currentPage: number
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

export function ReservationsPageHeader({
  propertyId,
  reservations,
  currentPage,
}: ReservationsPageHeaderProps) {
  const handleExport = (format: string) => {
    if (format !== "csv") return
    if (!reservations.length) return

    const filename = buildExportFilename("RES")

    exportToCsv<DashboardReservation>(filename, reservations, [
      { key: "confirmationNumber", header: "Confirmation" },
      { key: "guestName", header: "Guest" },
      { key: "siteName", header: "Site" },
      {
        key: "checkIn",
        header: "Check-in",
        accessor: (reservation) => formatDate(reservation.checkIn),
      },
      {
        key: "checkOut",
        header: "Check-out",
        accessor: (reservation) => formatDate(reservation.checkOut),
      },
      { key: "numNights", header: "Nights" },
      {
        key: "totalGuests",
        header: "Guests",
        accessor: (reservation) =>
          reservation.numAdults + reservation.numChildren,
      },
      {
        key: "totalAmount",
        header: "Total Amount",
        accessor: (reservation) => formatMoney(reservation.totalAmount),
      },
      {
        key: "paidAmount",
        header: "Paid Amount",
        accessor: (reservation) => formatMoney(reservation.paidAmount),
      },
      {
        key: "balanceOwed",
        header: "Balance Owed",
        accessor: (reservation) =>
          formatMoney(
            Math.max(0, reservation.totalAmount - reservation.paidAmount)
          ),
      },
      {
        key: "refundAmount",
        header: "Refunded Amount",
        accessor: (reservation) => formatMoney(reservation.refundAmount),
      },
      {
        key: "status",
        header: "Status",
        accessor: (reservation) => reservation.status.replace("_", " "),
      },
    ])
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">
          Reservations
        </h1>
        <p className="text-muted-foreground">
          Manage all your property bookings
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ExportMenu
          onExport={handleExport}
          disabled={!reservations.length}
          aria-label="Export reservations"
        />
        <Link href={`/dashboard/${propertyId}/reservations/new`}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Reservation
          </Button>
        </Link>
      </div>
    </div>
  )
}


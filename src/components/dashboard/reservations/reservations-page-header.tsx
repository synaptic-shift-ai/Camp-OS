"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { DashboardReservation } from "@/lib/dashboard/queries"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"
import { ExportMenu } from "@/components/ui/export-menu"
import { useToast } from "@/hooks/use-toast"

type ReservationsPageHeaderProps = {
  propertyId: string
  reservations: DashboardReservation[]
  currentPage: number
  total: number
  siteType?: string | null
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
  total,
  siteType,
}: ReservationsPageHeaderProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = (format: string) => {
    if (format !== "csv") return
    if (!total || total <= 0) return
    if (isExporting) return

    setIsExporting(true)

    void (async () => {
      try {
        const filename = buildExportFilename("RES")

        const res = await fetch("/api/v1/exports/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId,
            filters:
              siteType && siteType !== "all" ? { siteType } : {},
          }),
        })

        const json: any = await res.json()

        if (!res.ok || json?.success !== true) {
          throw new Error(json?.error?.message ?? "Export failed")
        }

        const exportedReservations = json.data as DashboardReservation[]

        exportToCsv<DashboardReservation>(filename, exportedReservations, [
          { key: "confirmationNumber", header: "Confirmation" },
          { key: "guestName", header: "Primary Guest" },
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
            header: "Total Guests",
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

        toast({
          title: "Export ready",
          description: "Reservations CSV has been downloaded.",
        })
      } catch (err) {
        toast({
          title: "Export failed",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsExporting(false)
      }
    })()
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">
          Reservations
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage all your property bookings
        </p>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <ExportMenu
          onExport={handleExport}
          disabled={isExporting || !total}
          aria-label="Export reservations"
        />
        <Link href={`/dashboard/${propertyId}/reservations/new`}>
          <Button className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            New Reservation
          </Button>
        </Link>
      </div>
    </div>
  )
}


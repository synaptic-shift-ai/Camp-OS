"use client"

import type { DashboardPayment } from "@/lib/dashboard/queries"
import { ExportMenu } from "@/components/ui/export-menu"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"

type PaymentsPageHeaderProps = {
  payments: DashboardPayment[]
  currentPage: number
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

export function PaymentsPageHeader({
  payments,
  currentPage,
}: PaymentsPageHeaderProps) {
  const handleExport = (format: string) => {
    if (format !== "csv") return
    if (!payments.length) return

    const filename = buildExportFilename("PAY")

    exportToCsv<DashboardPayment>(filename, payments, [
      {
        key: "createdAt",
        header: "Date",
        accessor: (payment) => formatDate(payment.createdAt),
      },
      { key: "guestName", header: "Guest" },
      { key: "confirmationNumber", header: "Reservation" },
      {
        key: "amount",
        header: "Amount",
        accessor: (payment) => formatMoney(payment.amount),
      },
      { key: "paymentMethod", header: "Method" },
      { key: "paymentStatus", header: "Status" },
    ])
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">
          Payments
        </h1>
        <p className="text-muted-foreground">
          Track and manage all transactions
        </p>
      </div>
      <ExportMenu
        onExport={handleExport}
        disabled={!payments.length}
        aria-label="Export payments"
      />
    </div>
  )
}


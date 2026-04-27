"use client"

import { useState } from "react"
import type { DashboardPayment } from "@/lib/dashboard/queries"
import { ExportMenu } from "@/components/ui/export-menu"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"
import { useToast } from "@/hooks/use-toast"

type PaymentsPageHeaderProps = {
  propertyId: string
  payments: DashboardPayment[]
  currentPage: number
  total: number
  canExportPayments: boolean
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

export function PaymentsPageHeader({ propertyId, total, canExportPayments }: PaymentsPageHeaderProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = (format: string) => {
    if (format !== "csv") return
    if (!total || total <= 0) return
    if (isExporting) return

    void (async () => {
      try {
        setIsExporting(true)
        const filename = buildExportFilename("PAY")

        const res = await fetch("/api/v1/exports/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId }),
        })

        const json: any = await res.json()
        if (!res.ok || json?.success !== true) {
          throw new Error(json?.error?.message ?? "Export failed")
        }

        const exportedPayments = json.data as DashboardPayment[]

        exportToCsv<DashboardPayment>(filename, exportedPayments, [
          {
            key: "createdAt",
            header: "Date",
            accessor: (payment) => formatDate(payment.createdAt),
          },
          { key: "guestName", header: "Primary Guest" },
          { key: "confirmationNumber", header: "Reservation" },
          {
            key: "amount",
            header: "Amount",
            accessor: (payment) => formatMoney(payment.amount),
          },
          { key: "paymentMethod", header: "Method" },
          { key: "paymentStatus", header: "Status" },
        ])

        toast({
          title: "Export ready",
          description: "Payments CSV has been downloaded.",
          variant: "success",
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
          Payments
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Track and manage all transactions
        </p>
      </div>
      <div className="self-end sm:self-auto">
        <ExportMenu
          onExport={handleExport}
          disabled={isExporting || total <= 0 || !canExportPayments}
          aria-label="Export payments"
        />
      </div>
    </div>
  )
}


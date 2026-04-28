"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { DashboardPayment } from "@/lib/dashboard/queries"
import { ExportMenu } from "@/components/ui/export-menu"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "payment", label: "Payments" },
  { value: "refund", label: "Refunds" },
  { value: "charge", label: "Charges" },
] as const

type PaymentsPageHeaderProps = {
  propertyId: string
  payments: DashboardPayment[]
  currentPage: number
  total: number
  canExportPayments: boolean
  typeFilter?: string
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
  propertyId,
  total,
  canExportPayments,
  typeFilter,
}: PaymentsPageHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleTypeFilterChange = (value: string) => {
    const params = new URLSearchParams(window.location.search)
    if (value === "all") {
      params.delete("type")
    } else {
      params.set("type", value)
    }
    params.set("page", "1")
    router.push(`/dashboard/${propertyId}/payments?${params.toString()}`)
  }

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
            key: "transactionType",
            header: "Type",
            accessor: (payment) => payment.transactionType ?? "Payment",
          },
          {
            key: "amount",
            header: "Amount",
            accessor: (payment) => formatMoney(payment.amount),
          },
          { key: "paymentMethod", header: "Method" },
          { key: "paymentStatus", header: "Status" },
          {
            key: "recognitionStatus",
            header: "Revenue Status",
            accessor: (payment) => payment.recognitionStatus ?? "",
          },
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
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Select
          value={typeFilter ?? "all"}
          onValueChange={handleTypeFilterChange}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExportMenu
          onExport={handleExport}
          disabled={isExporting || total <= 0 || !canExportPayments}
          aria-label="Export payments"
        />
      </div>
    </div>
  )
}

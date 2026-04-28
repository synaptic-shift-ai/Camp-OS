"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarPlus2, CreditCard } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PaymentStatus } from "@/contracts/booking"
import type { DashboardPayment, TransactionType, RecognitionStatus } from "@/lib/dashboard/queries"

const statusTextColors: Record<PaymentStatus, string> = {
  pending: "text-yellow-500",
  completed: "text-green-500",
  failed: "text-red-500",
  refunded: "text-gray-500",
}

const TYPE_BADGE_STYLES: Record<TransactionType, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  charge: { variant: "outline", className: "border-orange-300 text-orange-700 bg-orange-50" },
  payment: { variant: "default" },
  refund: { variant: "destructive" },
  deposit: { variant: "secondary" },
  deposit_release: { variant: "secondary", className: "text-blue-700 bg-blue-50" },
  deposit_deduction: { variant: "destructive", className: "bg-orange-100 text-orange-800 border-orange-200" },
  expense: { variant: "outline", className: "border-gray-300 text-gray-600" },
  platform_fee: { variant: "outline", className: "border-purple-300 text-purple-700 bg-purple-50" },
  payout: { variant: "secondary", className: "text-emerald-700 bg-emerald-50" },
}

const TYPE_LABELS: Record<TransactionType, string> = {
  charge: "Charge",
  payment: "Payment",
  refund: "Refund",
  deposit: "Deposit",
  deposit_release: "Deposit Release",
  deposit_deduction: "Deposit Deduction",
  expense: "Expense",
  platform_fee: "Platform Fee",
  payout: "Payout",
}

const RECOGNITION_BADGE: Record<RecognitionStatus, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending: { variant: "secondary", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  recognized: { variant: "default" },
  deferred: { variant: "outline", className: "border-blue-300 text-blue-700 bg-blue-50" },
  written_off: { variant: "destructive" },
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

function formatPaymentMethod(method: string): string {
  return method
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function getTypeBadge(type: TransactionType | null) {
  if (!type) return null
  const style = TYPE_BADGE_STYLES[type] ?? { variant: "outline" as const }
  return (
    <Badge variant={style.variant} className={style.className}>
      {TYPE_LABELS[type] ?? type}
    </Badge>
  )
}

function getRecognitionBadge(recognitionStatus: RecognitionStatus | null) {
  if (!recognitionStatus) return null
  const style = RECOGNITION_BADGE[recognitionStatus] ?? { variant: "outline" as const }
  return (
    <Badge variant={style.variant} className={`text-[10px] px-1.5 py-0 capitalize ${style.className ?? ""}`}>
      {recognitionStatus.replace("_", " ")}
    </Badge>
  )
}

type PaymentsTableProps = {
  propertyId: string
  payments: DashboardPayment[]
  currentPage: number
  pageSize: number
  total: number
  typeFilter?: string
}

export function PaymentsTable({
  propertyId,
  payments,
  currentPage,
  pageSize,
  total,
  typeFilter,
}: PaymentsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (!payments.length) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center min-h-[calc(100vh-14rem)] flex items-center justify-center">
        <div>
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CreditCard className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No payments yet</h3>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            Payments will appear here after guests complete a booking or make a payment.
          </p>
          <div className="mt-6 flex items-center justify-center">
            <Button size="lg" onClick={() => router.push(`/dashboard/${propertyId}`)}>
              <CalendarPlus2 className="mr-2 h-4 w-4" />
              Create reservation
            </Button>
          </div>
        </div>
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
    params.set("pageSize", String(pageSize))
    if (typeFilter) params.set("type", typeFilter)
    return `/dashboard/${propertyId}/payments?${params.toString()}`
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
      if (typeFilter) params.set("type", typeFilter)
      router.push(`/dashboard/${propertyId}/payments?${params.toString()}`)
    })
  }

  return (
    <>
      <div className="relative">
        {isPending && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/60"
            aria-busy="true"
            aria-label="Loading payments"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {/* Mobile card layout */}
        <div className="space-y-2 md:hidden">
          {payments.map((payment) => {
            const isCredit = payment.amount < 0
            return (
              <div key={payment.id} className="rounded-md border border-border/80 bg-card/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {payment.confirmationNumber}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold capitalize">
                      {payment.guestName}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-base font-semibold ${isCredit ? "text-green-600" : ""}`}>
                      {formatMoney(payment.amount)}
                    </p>
                    <div className="mt-1 flex flex-col items-end gap-1">
                      {getTypeBadge(payment.transactionType)}
                      <span
                        className={`${statusTextColors[payment.paymentStatus]} text-xs font-semibold uppercase`}
                      >
                        {payment.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 border-t border-border/70 pt-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="uppercase tracking-wide text-muted-foreground">Method</p>
                      <p className="mt-0.5 font-medium">{formatPaymentMethod(payment.paymentMethod)}</p>
                    </div>
                    {payment.transactionType === "charge" && payment.recognitionStatus && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Revenue:</span>
                        {getRecognitionBadge(payment.recognitionStatus)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {/* Desktop table layout */}
        <div className="hidden max-h-[calc(100vh-260px)] overflow-y-auto border border-border/80 bg-card/50 md:block">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
              <TableRow className="h-10 hover:bg-transparent data-[state=selected]:bg-transparent">
                <TableHead className="py-2 font-medium dark:text-white/90 text-black/90">Date</TableHead>
                <TableHead className="py-2 font-medium dark:text-white/90 text-black/90">Primary Guest</TableHead>
                <TableHead className="py-2 font-medium dark:text-white/90 text-black/90">Reservation</TableHead>
                <TableHead className="py-2 font-medium dark:text-white/90 text-black/90">Type</TableHead>
                <TableHead className="py-2 font-medium dark:text-white/90 text-black/90">Amount</TableHead>
                <TableHead className="py-2 font-medium dark:text-white/90 text-black/90">Method</TableHead>
                <TableHead className="py-2 font-medium dark:text-white/90 text-black/90">Status</TableHead>
                <TableHead className="py-2 font-medium dark:text-white/90 text-black/90">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const isCredit = payment.amount < 0
                return (
                  <TableRow key={payment.id} className="h-10">
                    <TableCell className="py-2">
                      {formatDate(payment.createdAt)}
                    </TableCell>
                    <TableCell className="py-2 font-medium capitalize">
                      {payment.guestName}
                    </TableCell>
                    <TableCell className="py-2">
                      {payment.confirmationNumber}
                    </TableCell>
                    <TableCell className="py-2">
                      {getTypeBadge(payment.transactionType)}
                    </TableCell>
                    <TableCell className={`py-2 font-medium ${isCredit ? "text-green-600" : ""}`}>
                      {formatMoney(payment.amount)}
                    </TableCell>
                    <TableCell className="py-2">
                      {formatPaymentMethod(payment.paymentMethod)}
                    </TableCell>
                    <TableCell className="py-2">
                      <span
                        className={`${statusTextColors[payment.paymentStatus]} text-xs font-semibold uppercase`}
                      >
                        {payment.paymentStatus}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      {payment.transactionType === "charge"
                        ? getRecognitionBadge(payment.recognitionStatus)
                        : <span className="text-muted-foreground">—</span>}
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
            of <span className="font-medium">{total}</span> payments
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
    </>
  )
}

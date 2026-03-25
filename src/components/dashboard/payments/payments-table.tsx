"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
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
import type { PaymentStatus } from "@/contracts/booking"
import type { DashboardPayment } from "@/lib/dashboard/queries"

const statusTextColors: Record<PaymentStatus, string> = {
  pending: "text-yellow-500",
  completed: "text-green-500",
  failed: "text-red-500",
  refunded: "text-gray-500",
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

type PaymentsTableProps = {
  propertyId: string
  payments: DashboardPayment[]
  currentPage: number
  pageSize: number
  total: number
}

export function PaymentsTable({
  propertyId,
  payments,
  currentPage,
  pageSize,
  total,
}: PaymentsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (!payments.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No payments yet. Payments will appear here after bookings.
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
        <div className="space-y-2 md:hidden">
          {payments.map((payment) => (
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
                <div className="text-right">
                  <p className="text-base font-semibold">{formatMoney(payment.amount)}</p>
                  <p
                    className={`${statusTextColors[payment.paymentStatus]} mt-1 text-xs font-semibold uppercase`}
                  >
                    {payment.paymentStatus}
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-border/70 pt-2 text-xs">
                <div>
                  <p className="uppercase tracking-wide text-muted-foreground">Method</p>
                  <p className="mt-0.5 font-medium">{formatPaymentMethod(payment.paymentMethod)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden max-h-[calc(100vh-260px)] overflow-y-auto border border-border/80 bg-card/50 md:block">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
              <TableRow className="h-10 hover:bg-transparent data-[state=selected]:bg-transparent">
                <TableHead className="py-2 font-medium text-white/90">Date</TableHead>
                <TableHead className="py-2 font-medium text-white/90">Primary Guest</TableHead>
                <TableHead className="py-2 font-medium text-white/90">Reservation</TableHead>
                <TableHead className="py-2 font-medium text-white/90">Amount</TableHead>
                <TableHead className="py-2 font-medium text-white/90">Method</TableHead>
                <TableHead className="py-2 font-medium text-white/90">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
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
                </TableRow>
              ))}
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

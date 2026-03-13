"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import type { PaymentStatus } from "@/contracts/booking"
import type { DashboardPayment } from "@/lib/dashboard/queries"

const statusColors: Record<PaymentStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  refunded: "bg-gray-500/10 text-gray-500 border-gray-500/20",
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
    return `/dashboard/${propertyId}/payments?${params.toString()}`
  }

  const goToPage = (page: number) => {
    startTransition(() => {
      router.push(buildPageHref(page))
    })
  }

  return (
    <>
      <div className="relative">
        {isPending && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-background/60"
            aria-busy="true"
            aria-label="Loading payments"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div className="max-h-[calc(100vh-260px)] overflow-y-auto border rounded-md">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="h-8">
                <TableHead className="py-1.5">Date</TableHead>
                <TableHead className="py-1.5">Guest</TableHead>
                <TableHead className="py-1.5">Reservation</TableHead>
                <TableHead className="py-1.5">Amount</TableHead>
                <TableHead className="py-1.5">Method</TableHead>
                <TableHead className="py-1.5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id} className="h-8">
                  <TableCell className="py-1.5">
                    {formatDate(payment.createdAt)}
                  </TableCell>
                  <TableCell className="py-1.5 font-medium">
                    {payment.guestName}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {payment.confirmationNumber}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {formatMoney(payment.amount)}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {formatPaymentMethod(payment.paymentMethod)}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Badge
                      variant="outline"
                      className={`${statusColors[payment.paymentStatus]} text-xs px-2 py-0.5`}
                    >
                      {payment.paymentStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
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
          of <span className="font-medium">{total}</span> payments
        </div>
        <Pagination
          currentPage={clampedCurrentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          disabled={isPending}
          windowSize={4}
        />
      </div>
    </>
  )
}

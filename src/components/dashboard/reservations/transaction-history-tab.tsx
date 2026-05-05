'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ManualPaymentDialog } from '@/components/admin/manual-payment-dialog'
import { DollarSign } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Receipt } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TransactionType =
  | 'payment'
  | 'refund'
  | 'deposit'
  | 'deposit_release'
  | 'deposit_deduction'
  | 'expense'
  | 'platform_fee'
  | 'payout'
  | 'charge'

interface Transaction {
  id: string
  type: TransactionType
  source: string | null
  description?: string | null
  amount_cents: number
  status: string
  is_voided: boolean
  created_at: string
  processed_at: string | null
  notes: string | null
}

interface TransactionsResponse {
  success: boolean
  data: {
    reservation_id: string
    transactions: Transaction[]
    total: number
    page: number
    page_size: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'charge', label: 'Charges' },
  { value: 'payment', label: 'Payments' },
  { value: 'refund', label: 'Refunds' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'deposit_release', label: 'Deposit Releases' },
  { value: 'deposit_deduction', label: 'Deposit Deductions' },
  { value: 'expense', label: 'Expenses' },
  { value: 'platform_fee', label: 'Platform Fees' },
  { value: 'payout', label: 'Payouts' },
] as const

const TYPE_BADGE_STYLES: Record<TransactionType, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  charge: { variant: 'outline', className: 'border-orange-300 text-orange-700 bg-orange-50' },
  payment: { variant: 'default' },
  refund: { variant: 'destructive' },
  deposit: { variant: 'secondary' },
  deposit_release: { variant: 'secondary', className: 'text-blue-700 bg-blue-50' },
  deposit_deduction: { variant: 'destructive', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  expense: { variant: 'outline', className: 'border-gray-300 text-gray-600' },
  platform_fee: { variant: 'outline', className: 'border-purple-300 text-purple-700 bg-purple-50' },
  payout: { variant: 'secondary', className: 'text-emerald-700 bg-emerald-50' },
}

const TYPE_LABELS: Record<TransactionType, string> = {
  charge: 'Charge',
  payment: 'Payment',
  refund: 'Refund',
  deposit: 'Deposit',
  deposit_release: 'Deposit Release',
  deposit_deduction: 'Deposit Deduction',
  expense: 'Expense',
  platform_fee: 'Platform Fee',
  payout: 'Payout',
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  completed: { variant: 'default' },
  pending: { variant: 'secondary', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  failed: { variant: 'destructive' },
  voided: { variant: 'outline', className: 'text-gray-500' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type TransactionHistoryTabProps = {
  reservationId: string
  confirmationNumber: string
  guestName: string
  guestId: string | null
  canRecordPayment: boolean
  totalAmountCents: number
  paidAmountCents: number
}

export function TransactionHistoryTab({
  reservationId,
  confirmationNumber,
  guestName,
  guestId,
  canRecordPayment,
  totalAmountCents,
  paidAmountCents,
}: TransactionHistoryTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCents, setTotalCents] = useState(totalAmountCents)
  const [paidCents, setPaidCents] = useState(paidAmountCents)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    setTotalCents(totalAmountCents)
    setPaidCents(paidAmountCents)
  }, [totalAmountCents, paidAmountCents])

  const refreshReservationAmounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/reservations/${reservationId}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data as { total_amount?: number; paid_amount?: number }
        setTotalCents(d.total_amount ?? 0)
        setPaidCents(d.paid_amount ?? 0)
      }
    } catch {
      // Keep existing totals on failure
    }
  }, [reservationId])

  const fetchTransactions = useCallback(
    async (
      currentPage: number,
      currentTypeFilter: string,
      mode: 'full' | 'inline' = 'full',
    ) => {
      if (mode === 'full') {
        setLoading(true)
      }
      setError(null)

      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
        })
        if (currentTypeFilter !== 'all') {
          params.set('type', currentTypeFilter)
        }

        const res = await fetch(
          `/api/v1/financial/reservations/${reservationId}/transactions?${params}`,
          { credentials: 'include' },
        )
        const json: TransactionsResponse = await res.json()

        if (json.success) {
          setTransactions(json.data.transactions)
          setTotal(json.data.total)
          setPage(json.data.page)
        } else {
          setError('Failed to load transactions')
        }
      } catch {
        setError('Failed to load transactions')
      } finally {
        if (mode === 'full') {
          setLoading(false)
        }
      }
    },
    [reservationId],
  )

  const handlePaymentRecorded = useCallback(() => {
    void fetchTransactions(page, typeFilter, 'inline')
    void refreshReservationAmounts()
  }, [fetchTransactions, page, typeFilter, refreshReservationAmounts])

  // Initial load + refetch on filter/page changes
  useEffect(() => {
    void fetchTransactions(page, typeFilter, 'full')
  }, [fetchTransactions, page, typeFilter])

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value)
    setPage(1) // Reset to first page when filter changes
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  // --- Loading skeleton (avoid replacing the whole tab after inline refresh) ---
  if (loading && transactions.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="rounded-md border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b p-3 last:border-b-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20 justify-end" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => fetchTransactions(page, typeFilter)}
        >
          Try again
        </button>
      </div>
    )
  }

  // --- Empty state ---
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Receipt className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">No transactions recorded</p>
        <p className="text-xs text-muted-foreground/70">
          Transactions will appear here once charges, payments, or refunds are processed.
        </p>
      </div>
    )
  }

  const statusStyle = (status: string) => STATUS_BADGE[status] ?? { variant: 'outline' as const }

  const outstandingBalance = Math.max(0, totalCents - paidCents)

  return (
    <div className="space-y-3">
      {/* Balance + Record Payment header */}
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Outstanding Balance</div>
          <div className={`mt-0.5 text-lg font-semibold ${outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatMoney(outstandingBalance)}
          </div>
        </div>
        {canRecordPayment && outstandingBalance > 0 && (
          <ManualPaymentDialog
            reservationId={reservationId}
            confirmationNumber={confirmationNumber}
            guestName={guestName}
            guestId={guestId}
            totalAmountCents={totalCents}
            paidAmountCents={paidCents}
            onSuccess={handlePaymentRecorded}
            trigger={
              <Button className="gap-2" size="sm">
                <DollarSign className="h-4 w-4" />
                Record Payment
              </Button>
            }
          />
        )}
      </div>

      {/* Header with type filter */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {total} transaction{total !== 1 ? 's' : ''} total
        </p>
        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
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
      </div>

      {/* Transaction table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">Date</TableHead>
              <TableHead className="w-[110px]">Type</TableHead>
              <TableHead className="w-[100px]">Source</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-[110px]">Amount</TableHead>
              <TableHead className="text-right w-[90px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((txn) => {
              const badgeStyle = TYPE_BADGE_STYLES[txn.type as TransactionType] ?? { variant: 'outline' as const }
              const txnStatus = statusStyle(txn.status)
              const isCredit = txn.amount_cents < 0

              return (
                <TableRow
                  key={txn.id}
                  className={txn.is_voided ? 'opacity-60' : undefined}
                >
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    <span className={txn.is_voided ? 'line-through' : undefined}>
                      {formatDateTime(txn.created_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={badgeStyle.variant}
                        className={badgeStyle.className}
                      >
                        {TYPE_LABELS[txn.type as TransactionType] ?? txn.type}
                      </Badge>
                      {txn.is_voided && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-400 border-gray-300">
                          Voided
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs capitalize">
                    <span className={txn.is_voided ? 'line-through' : undefined}>
                      {txn.source ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    <span className={txn.is_voided ? 'line-through' : undefined}>
                      {txn.notes ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`whitespace-nowrap text-right text-xs font-medium ${
                      txn.is_voided ? 'line-through' : isCredit ? 'text-green-600' : ''
                    }`}
                  >
                    {formatMoney(txn.amount_cents)}
                    {isCredit && !txn.is_voided && (
                      <span className="ml-1 text-[10px] text-green-500">(Credit)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={txnStatus.variant}
                      className={`text-[10px] px-1.5 py-0 capitalize ${txnStatus.className ?? ''}`}
                    >
                      {txn.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            disabled={loading}
          />
        </div>
      )}
    </div>
  )
}

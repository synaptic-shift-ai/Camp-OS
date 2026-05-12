'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Types — must match the Transaction type in transaction-history-tab.tsx
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

// ---------------------------------------------------------------------------
// Constants (mirrored from transaction-history-tab for consistency)
// ---------------------------------------------------------------------------

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

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '—') return null
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type TransactionDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
}

export function TransactionDetailDialog({ open, onOpenChange, transaction }: TransactionDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-y-auto bg-background p-6 text-foreground sm:rounded-lg">
        {transaction ? (() => {
          const isCredit = transaction.amount_cents < 0
          const badgeStyle = TYPE_BADGE_STYLES[transaction.type as TransactionType] ?? { variant: 'outline' as const }
          const statusStyle = STATUS_BADGE[transaction.status] ?? { variant: 'outline' as const }

          return (
            <>
              <DialogHeader className="space-y-2 pb-5 text-left">
                <DialogTitle className="text-lg font-semibold leading-tight text-foreground">
                  Transaction Details
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  View details for this transaction.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* Header card with amount and type */}
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-semibold text-sm">
                    {transaction.type.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">
                      {TYPE_LABELS[transaction.type as TransactionType] ?? transaction.type}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.source ?? 'No source'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-semibold ${transaction.is_voided ? 'line-through text-muted-foreground' : isCredit ? 'text-green-600' : ''}`}>
                      {formatMoney(transaction.amount_cents)}
                    </p>
                  </div>
                </div>

                {/* Detail fields grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Type */}
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={badgeStyle.variant} className={badgeStyle.className}>
                        {TYPE_LABELS[transaction.type as TransactionType] ?? transaction.type}
                      </Badge>
                      {transaction.is_voided && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-400 border-gray-300">
                          Voided
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className="mt-2">
                      <Badge
                        variant={statusStyle.variant}
                        className={`text-[10px] px-1.5 py-0 capitalize ${statusStyle.className ?? ''}`}
                      >
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>

                  <DetailField label="Source" value={transaction.source} />
                  <DetailField label="Amount" value={formatMoney(Math.abs(transaction.amount_cents))} />
                  <DetailField label="Description / Notes" value={transaction.notes ?? transaction.description} />
                  <DetailField label="Created Date" value={formatDateTime(transaction.created_at)} />
                  <DetailField label="Processed Date" value={transaction.processed_at ? formatDateTime(transaction.processed_at) : null} />
                  <DetailField label="Voided" value={transaction.is_voided ? 'Yes' : null} />
                  <DetailField label="Transaction ID" value={transaction.id} />
                </div>
              </div>
            </>
          )
        })() : null}
      </DialogContent>
    </Dialog>
  )
}

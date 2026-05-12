'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { DashboardPayment, TransactionType, RecognitionStatus } from '@/lib/dashboard/queries'
import type { PaymentStatus } from '@/contracts/booking'

const statusTextColors: Record<PaymentStatus, string> = {
  pending: 'text-yellow-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  refunded: 'text-gray-500',
}

const TYPE_BADGE_STYLES: Record<
  TransactionType,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
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

const RECOGNITION_BADGE: Record<
  RecognitionStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  pending: { variant: 'secondary', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  recognized: { variant: 'default' },
  deferred: { variant: 'outline', className: 'border-blue-300 text-blue-700 bg-blue-50' },
  written_off: { variant: 'destructive' },
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPaymentMethod(method: string): string {
  return method
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
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

type PaymentDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: DashboardPayment | null
}

export function PaymentDetailDialog({ open, onOpenChange, payment }: PaymentDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-y-auto bg-background p-6 text-foreground sm:rounded-lg">
        {payment ? (() => {
          const isCredit = payment.amount < 0
          return (<>
            <DialogHeader className="space-y-2 pb-5 text-left">
              <DialogTitle className="text-lg font-semibold leading-tight text-foreground">
                Payment Details
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                View details for this payment.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
          {/* Header card with amount and guest */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-semibold text-sm">
              {payment.guestName
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'P'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground truncate capitalize">
                {payment.guestName}
              </div>
              <div className="text-sm text-muted-foreground">
                {payment.confirmationNumber}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-lg font-semibold ${isCredit ? 'text-green-600' : ''}`}>
                {formatMoney(payment.amount)}
              </p>
            </div>
          </div>

          {/* Detail fields grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Reservation" value={payment.confirmationNumber} />

            {/* Transaction Type with badge */}
            {payment.transactionType && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                <div className="mt-2">
                  <Badge
                    variant={TYPE_BADGE_STYLES[payment.transactionType]?.variant ?? 'outline'}
                    className={TYPE_BADGE_STYLES[payment.transactionType]?.className}
                  >
                    {TYPE_LABELS[payment.transactionType] ?? payment.transactionType}
                  </Badge>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
              <p className={`mt-2 text-sm font-semibold uppercase ${statusTextColors[payment.paymentStatus]}`}>
                {payment.paymentStatus}
              </p>
            </div>

            <DetailField label="Payment Method" value={formatPaymentMethod(payment.paymentMethod)} />
            <DetailField label="Created Date" value={formatDate(payment.createdAt)} />
            <DetailField label="Processed Date" value={payment.processedAt ? formatDate(payment.processedAt) : null} />

            {/* Revenue Recognition */}
            {payment.transactionType === 'charge' && payment.recognitionStatus && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue Recognition</p>
                <div className="mt-2">
                  <Badge
                    variant={RECOGNITION_BADGE[payment.recognitionStatus]?.variant ?? 'outline'}
                    className={`text-[10px] px-1.5 py-0 capitalize ${RECOGNITION_BADGE[payment.recognitionStatus]?.className ?? ''}`}
                  >
                    {payment.recognitionStatus.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            )}

            <DetailField label="Stripe Payment ID" value={payment.stripePaymentId} />
          </div>
            </div>
          </>)
        })() : null}
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, DollarSign, ArrowUp, ArrowDown, CreditCard, Undo2, CircleDashed } from "lucide-react"
import type { MoneyCents } from "@/contracts/booking"
import { usePermissions } from "@/hooks/use-permissions"
import { ManualPaymentDialog } from "@/components/admin/manual-payment-dialog"
import { RefundReservationDialog } from "@/components/admin/refund-reservation-dialog"
import { ReservationPosTransactionDialog } from "@/components/dashboard/pos/reservation-pos-transaction-dialog"
import { CardOnFileDialog } from "@/components/admin/card-on-file-dialog"

type ReservationLedgerStatus = string

type TransactionType =
  | "payment"
  | "refund"
  | "deposit"
  | "deposit_release"
  | "deposit_deduction"
  | "expense"
  | "platform_fee"
  | "payout"
  | "charge"

type LedgerTransaction = {
  id: string
  reservation_id: string
  type: TransactionType
  source: string | null
  description?: string | null
  notes?: string | null
  amount_cents: number
  status: string
  is_voided: boolean
  created_by: string | null
  created_at: string
  processed_at: string | null
}

type ReservationLedgerReservation = {
  id: string
  confirmation_number: string
  guest_id: string
  guest?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null
  check_in_date: string
  check_out_date: string
  nights?: number
  total_amount: number
  paid_amount: number
  refund_amount_cents?: number | null
  payment_card?:
    | {
        brand: string
        last4: string
        exp_month: number
        exp_year: number
      }
    | null
  status: ReservationLedgerStatus
  created_at: string
  site?: { site_name?: string | null; site_number?: string | null } | null
  property_id?: string
}

type ReservationBalanceSummary = {
  charges_total: number
  payments_total: number
  refunds_total: number
  balance: number
  guest_credit_balance: number
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function formatMoneyNoSign(centsAbs: number): string {
  return formatMoney(Math.abs(centsAbs))
}

function prefixSignedAmount(amountCents: number): string {
  const abs = Math.abs(amountCents)
  const sign = amountCents < 0 ? "-" : "+"
  return `${sign}${formatMoneyNoSign(abs)}`
}

function normalizeGuestName(res: ReservationLedgerReservation): string {
  const first = res.guest?.first_name ?? ""
  const last = res.guest?.last_name ?? ""
  const joined = `${first} ${last}`.trim()
  if (joined.length > 0) return joined
  return "Guest"
}

function transactionUi(txn: LedgerTransaction): { badgeText: string; badgeTone: "charge" | "payment" | "refund" | "other"; icon: JSX.Element } {
  const baseLabel = txn.notes?.trim() || txn.description?.trim() || txn.source || txn.type
  if (txn.type === "charge") return { badgeText: baseLabel, badgeTone: "charge", icon: <ArrowUp className="h-4 w-4" /> }
  if (txn.type === "payment") return { badgeText: baseLabel, badgeTone: "payment", icon: <ArrowDown className="h-4 w-4" /> }
  if (txn.type === "refund") return { badgeText: baseLabel, badgeTone: "refund", icon: <Undo2 className="h-4 w-4" /> }
  return { badgeText: baseLabel, badgeTone: "other", icon: <CircleDashed className="h-4 w-4" /> }
}

export function ReservationLedgerPage({
  propertyId,
  reservationId,
}: {
  propertyId: string
  reservationId: string
}) {
  const { can } = usePermissions()

  const [reservation, setReservation] = useState<ReservationLedgerReservation | null>(null)
  const [balance, setBalance] = useState<ReservationBalanceSummary | null>(null)
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canRecordPayment = can("financial.record_payment")
  const canRefund = can("reservations.refund")

  // Stats shown on the page should reflect the reservation snapshot (what the user owes/paid)
  // rather than the ledger totals (which can be temporarily out of sync during writes).
  const unpaidBalanceCents = useMemo(() => {
    if (!reservation) return 0 as MoneyCents
    return Math.max(0, (reservation.total_amount ?? 0) - (reservation.paid_amount ?? 0)) as MoneyCents
  }, [reservation])

  const totalChargesCents = useMemo(() => {
    if (!reservation) return balance?.charges_total ?? 0
    return reservation.total_amount ?? 0
  }, [reservation, balance])

  const totalPaymentsCents = useMemo(() => {
    if (!reservation) return balance?.payments_total ?? 0
    return reservation.paid_amount ?? 0
  }, [reservation, balance])

  const totalRefundsCents = useMemo(() => {
    if (!reservation) return balance?.refunds_total ?? 0
    return reservation.refund_amount_cents ?? 0
  }, [reservation, balance])

  const isMountedRef = useRef(true)
  const fetchRequestIdRef = useRef(0)

  const fetchAll = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current
    setLoading(true)
    setError(null)

    try {
      const [reservationRes, balanceRes, txnsRes] = await Promise.all([
        fetch(`/api/v1/reservations/${reservationId}`, { credentials: "include" }),
        fetch(`/api/v1/financial/reservations/${reservationId}/balance`, { credentials: "include" }),
        fetch(
          `/api/v1/financial/reservations/${reservationId}/transactions?page=1&pageSize=50`,
          { credentials: "include" },
        ),
      ])

      if (!reservationRes.ok || !balanceRes.ok || !txnsRes.ok) {
        throw new Error("Failed to load reservation ledger")
      }

      const reservationJson = await reservationRes.json()
      const balanceJson = await balanceRes.json()
      const txnsJson = await txnsRes.json()

      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return

      const reservationData = reservationJson?.data
      const balanceData = balanceJson?.data
      const txns = txnsJson?.data?.transactions ?? []

      if (!reservationData || !balanceData) {
        throw new Error("Reservation ledger data missing")
      }

      setReservation(reservationData as ReservationLedgerReservation)
      setBalance(balanceData as ReservationBalanceSummary)
      setTransactions(txns as LedgerTransaction[])
    } catch (err) {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return
      setError(err instanceof Error ? err.message : "Failed to load reservation ledger")
    } finally {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return
      setLoading(false)
    }
  }, [reservationId])

  useEffect(() => {
    isMountedRef.current = true
    void fetchAll()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchAll])

  const guestName = reservation ? normalizeGuestName(reservation) : "Guest"

  const headerDates = reservation ? `${formatDate(reservation.check_in_date)} - ${formatDate(reservation.check_out_date)}` : ""

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl truncate">
              {reservation ? reservation.confirmation_number : "Reservation"}
            </h1>
            {reservation ? (
              <Badge variant="outline" className="capitalize">
                {reservation.status.replaceAll("_", " ")}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {headerDates ? headerDates : <Skeleton className="h-4 w-72" />}
            {reservation ? ` · ${guestName}` : null}
          </p>
        </div>

        <div className="flex items-center gap-2 self-end">
          <Link href={`/dashboard/${propertyId}/reservations`}>
            <Button variant="outline" className="gap-2">
              <Eye className="h-4 w-4" />
              Back to reservations
            </Button>
          </Link>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canRecordPayment ? (
          <ManualPaymentDialog
            reservationId={reservation?.id ?? reservationId}
            confirmationNumber={reservation?.confirmation_number ?? "—"}
            guestName={guestName}
            totalAmountCents={(reservation?.total_amount ?? 0) as MoneyCents}
            paidAmountCents={(reservation?.paid_amount ?? 0) as MoneyCents}
            guestId={reservation?.guest_id ?? null}
            trigger={
              <Button className="gap-2" size="sm" disabled={loading}>
                <DollarSign className="h-4 w-4" />
                Record Payment
              </Button>
            }
          />
        ) : null}

        {canRecordPayment ? (
          <ReservationPosTransactionDialog
            reservationId={reservation?.id ?? reservationId}
            guestId={reservation?.guest_id ?? null}
            mode="charge_only"
            onSuccess={() => {
              void fetchAll()
            }}
            trigger={
              <Button variant="outline" size="sm" disabled={loading} className="gap-2">
                <span aria-hidden="true">$</span>
                Add Charge
              </Button>
            }
          />
        ) : null}

        {canRefund ? (
          <RefundReservationDialog
            reservationId={reservation?.id ?? reservationId}
            confirmationNumber={reservation?.confirmation_number ?? "—"}
            guestName={guestName}
            maxRefundableCents={Math.max(
              0,
              (reservation?.paid_amount ?? 0) - ((reservation?.refund_amount_cents ?? 0) as number),
            )}
            trigger={
              <Button variant="outline" size="sm" disabled={loading} className="gap-2">
                <Undo2 className="h-4 w-4" />
                Issue Refund
              </Button>
            }
          />
        ) : null}

        {canRecordPayment ? (
          <CardOnFileDialog
            reservationId={reservation?.id ?? reservationId}
            confirmationNumber={reservation?.confirmation_number ?? "—"}
            guestName={guestName}
            totalAmountCents={(reservation?.total_amount ?? 0) as MoneyCents}
            paidAmountCents={(reservation?.paid_amount ?? 0) as MoneyCents}
            guestId={reservation?.guest_id ?? null}
            paymentCard={reservation?.payment_card ?? null}
            trigger={
              <Button variant="outline" size="sm" disabled={loading} className="gap-2">
                <CreditCard className="h-4 w-4" />
                Card on File
              </Button>
            }
          />
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-5 items-stretch">
        <Card className="md:col-span-2 h-full">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground">Computed Balance</div>
              <div className="text-2xl font-bold tabular-nums">
                {loading ? <Skeleton className="h-8 w-28" /> : formatMoney(unpaidBalanceCents)}
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
              <Badge variant="secondary" className="font-medium">
                Active ledger
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Amount left to pay (reservation total minus paid amount).
            </p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-sm text-muted-foreground">Total Charges</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{loading ? <Skeleton className="h-8 w-24" /> : formatMoney(totalChargesCents)}</div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-sm text-muted-foreground">Total Payments</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{loading ? <Skeleton className="h-8 w-24" /> : formatMoney(totalPaymentsCents)}</div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-sm text-muted-foreground">Total Refunds</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{loading ? <Skeleton className="h-8 w-24" /> : formatMoney(totalRefundsCents)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">Transaction History</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {loading ? <Skeleton className="h-8 w-24" /> : `${transactions.length} records`}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{loading ? "" : "Sorted by date"}</div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CircleDashed className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No transactions recorded</p>
              <p className="text-xs text-muted-foreground/70">
                Charges, payments, and refunds will appear here once they are processed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {transactions.map((txn) => {
                const ui = transactionUi(txn)
                const isCredit = txn.amount_cents < 0
                const amountTone =
                  ui.badgeTone === "refund"
                    ? "text-destructive"
                    : ui.badgeTone === "charge"
                      ? "text-orange-600 dark:text-orange-400"
                      : ui.badgeTone === "payment"
                        ? "text-green-600 dark:text-green-400"
                        : "text-foreground"

                const iconTone =
                  ui.badgeTone === "refund"
                    ? "bg-red-50 text-red-600 border-red-200"
                    : ui.badgeTone === "charge"
                      ? "bg-orange-50 text-orange-600 border-orange-200"
                      : ui.badgeTone === "payment"
                        ? "bg-green-50 text-green-600 border-green-200"
                        : "bg-muted/30 text-muted-foreground border-border"

                return (
                  <div key={txn.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border ${iconTone}`}>
                        {ui.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{ui.badgeText || txn.type}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground truncate">
                          {txn.source ?? "—"}
                          {txn.is_voided ? " · Voided" : null}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold tabular-nums ${amountTone} ${txn.is_voided ? "opacity-60 line-through" : ""}`}>
                        {prefixSignedAmount(txn.amount_cents)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(txn.created_at)}</div>
                      {txn.created_by ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{txn.created_by}</div>
                      ) : null}
                      {isCredit && !txn.is_voided ? <div className="mt-0.5 text-[10px] text-green-500">Credit</div> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


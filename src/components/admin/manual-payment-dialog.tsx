"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Banknote, CreditCard, DollarSign, FileText, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "../ui/input"
import { useToast } from "@/hooks/use-toast"
import { isAccessDeniedError } from "@/lib/utils/is-access-denied-error"

interface ManualPaymentDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  totalAmountCents: number
  paidAmountCents: number
  guestId?: string
  trigger: React.ReactNode
}

// ---------------------------------------------------------------------------
// Payment method definitions
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = [
  { value: "credit_card", label: "Card", icon: CreditCard },
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "check", label: "Check", icon: FileText },
  { value: "bank_transfer", label: "ACH", icon: Banknote },
  { value: "store_credit", label: "Credit", icon: CreditCard },
  { value: "other", label: "Other", icon: Banknote },
] as const

type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"]

// Methods that require a reference field
const METHODS_WITH_REFERENCE: ReadonlySet<PaymentMethodValue> = new Set(["check", "bank_transfer"])

// Methods that show processor select
const METHODS_WITH_PROCESSOR: ReadonlySet<PaymentMethodValue> = new Set(["credit_card"])

const PROCESSOR_OPTIONS = [
  { value: "none", label: "None (Manual)" },
  { value: "stripe", label: "Stripe" },
] as const

// Map UI method values to API payment_method enum values
const METHOD_TO_API: Record<string, string> = {
  credit_card: "credit_card",
  cash: "cash",
  check: "check",
  bank_transfer: "bank_transfer",
  store_credit: "store_credit",
  other: "cash", // Default to cash for "Other"
}

// ---------------------------------------------------------------------------
// Balance API types
// ---------------------------------------------------------------------------

interface BalanceData {
  charges_total: number
  payments_total: number
  refunds_total: number
  balance: number
  guest_credit_balance: number
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManualPaymentDialog({
  reservationId,
  confirmationNumber,
  guestName,
  totalAmountCents,
  paidAmountCents,
  guestId,
  trigger,
}: ManualPaymentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [amountDollars, setAmountDollars] = useState("")
  const [reference, setReference] = useState("")
  const [processor, setProcessor] = useState("none")
  const [useCardOnFile, setUseCardOnFile] = useState(false)
  // Balance from financial API (in cents)
  const [apiBalance, setApiBalance] = useState<number | null>(null)
  const { toast } = useToast()

  // Determine outstanding balance: prefer API balance, fall back to prop-based calculation
  const outstandingBalance = Math.max(0, apiBalance ?? (totalAmountCents - paidAmountCents))
  const balanceInDollars = (outstandingBalance / 100).toFixed(2)
  const hasBalance = outstandingBalance > 0

  const amountCentsEntered = Math.round(parseFloat(amountDollars || "0") * 100)
  const isAmountValid =
    amountCentsEntered >= 1 && amountCentsEntered <= outstandingBalance

  // Determine if conditional fields should show
  const selectedMethod = paymentMethod as PaymentMethodValue
  const showReference = METHODS_WITH_REFERENCE.has(selectedMethod)
  const showProcessor = METHODS_WITH_PROCESSOR.has(selectedMethod)

  // Fetch balance from financial API when dialog opens
  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true)
    try {
      const res = await fetch(`/api/v1/financial/reservations/${reservationId}/balance`)
      const json = await res.json()
      if (json.success && json.data) {
        const data: BalanceData = json.data
        // Prefer ledger balance when it looks complete. However, we can have partial
        // ledger data (e.g. PAYMENT rows written without matching CHARGE rows yet),
        // which would make `balance` incorrect (often <= 0). In that case, derive
        // outstanding balance from reservation total minus ledger payments/refunds.
        const hasLedgerActivity =
          data.charges_total !== 0 || data.payments_total !== 0 || data.refunds_total !== 0

        if (!hasLedgerActivity) return

        // If no charges recorded yet, treat reservation total as the charge basis.
        if (data.charges_total === 0) {
          const derivedOutstanding = Math.max(
            0,
            totalAmountCents - data.payments_total - data.refunds_total,
          )
          setApiBalance(derivedOutstanding)
          return
        }

        setApiBalance(data.balance)
      }
    } catch {
      // Silently fall back to prop-based balance
    } finally {
      setBalanceLoading(false)
    }
  }, [reservationId])

  useEffect(() => {
    if (!open) return

    // Reset form state
    setError(null)
    setPaymentMethod("")
    setReference("")
    setProcessor("none")
    setUseCardOnFile(false)
    setApiBalance(null)
    setAmountDollars("")

    // Fetch balance and pre-fill amount
    fetchBalance().then(() => {
      // Will be set after fetchBalance completes and apiBalance is updated
    })
  }, [open, fetchBalance])

  // Pre-fill amount once balance is available
  useEffect(() => {
    if (!open) return
    const balance = apiBalance ?? Math.max(0, totalAmountCents - paidAmountCents)
    if (balance > 0 && !amountDollars) {
      setAmountDollars((balance / 100).toFixed(2))
    }
  }, [open, apiBalance, totalAmountCents, paidAmountCents, amountDollars])

  const handleRecordPayment = async () => {
    const amountCents = Math.round(parseFloat(amountDollars || "0") * 100)

    if (!paymentMethod) return

    if (amountCents < 1) {
      setError("Amount must be greater than 0")
      return
    }
    if (amountCents > outstandingBalance) {
      setError(`Amount cannot exceed outstanding balance ($${balanceInDollars})`)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const apiMethod = METHOD_TO_API[paymentMethod] ?? "cash"

      const response = await fetch(`/api/v1/financial/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservation_id: reservationId,
          guest_id: guestId ?? null,
          amount_cents: amountCents,
          payment_method: apiMethod,
          processor: showProcessor && processor !== "none" ? processor : null,
          reference: showReference && reference.trim() ? reference.trim() : null,
          source: "manual",
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data?.error?.message ??
          data?.error?.details?.message ??
          "Failed to record manual payment"
        throw new Error(message)
      }

      toast({
        title: "Payment recorded",
        description: "Manual payment has been recorded successfully.",
        variant: "success",
      })
      setOpen(false)
      router.refresh()
    } catch (err) {
      if (isAccessDeniedError(err)) {
        toast({
          title: 'Access denied',
          description: "You don't have permission for this action. Contact your property administrator if you believe this is an error.",
          variant: 'destructive',
          className: SEASON_ALERT_TOAST_CLASS,
        })
        return
      }
      console.error("[ManualPaymentDialog] Error recording payment", err)
      toast({
        title: "Payment failed",
        description: err instanceof Error ? err.message : "An unexpected error occurred",
        variant: "destructive",
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent className="w-[90vw] max-w-[90vw] overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Manual Payment</SheetTitle>
          <SheetDescription>
            Record a manual payment for {guestName} ({confirmationNumber})
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Confirmation:</span>{" "}
              <span className="text-muted-foreground">{confirmationNumber}</span>
            </div>
            <div>
              <span className="font-medium">Guest:</span>{" "}
              <span className="text-muted-foreground capitalize">{guestName}</span>
            </div>
          </div>

          {hasBalance ? (
            <>
              <div className="space-y-2">
                <Label>Balance Due</Label>
                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-semibold">
                      {balanceLoading ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading balance…
                        </span>
                      ) : (
                        <>Outstanding Balance: ${balanceInDollars}</>
                      )}
                    </span>
                  </AlertDescription>
                </Alert>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-payment-method">Collect Payment</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(val) => {
                    setPaymentMethod(val)
                    // Clear conditional fields when method changes
                    setReference("")
                    setProcessor("none")
                    setUseCardOnFile(false)
                  }}
                >
                  <SelectTrigger id="manual-payment-method">
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <method.icon className="h-4 w-4" />
                          <span>
                            {method.label} — ${balanceInDollars}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Processor select — shown for Card payments */}
              {showProcessor && (
                <div className="space-y-2">
                  <Label htmlFor="payment-processor">Processor</Label>
                  <Select value={processor} onValueChange={setProcessor}>
                    <SelectTrigger id="payment-processor">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCESSOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Card on file switch — shown for Card payments */}
              {showProcessor && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="card-on-file" className="text-sm">
                      Use Card on File
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Charge the guest&apos;s stored payment method
                    </p>
                  </div>
                  <Switch
                    id="card-on-file"
                    checked={useCardOnFile}
                    onCheckedChange={setUseCardOnFile}
                  />
                </div>
              )}

              {/* Reference input — shown for Check and ACH */}
              {showReference && (
                <div className="space-y-2">
                  <Label htmlFor="payment-reference">
                    {selectedMethod === "check" ? "Check Number" : "Reference (Optional)"}
                  </Label>
                  <Input
                    id="payment-reference"
                    type="text"
                    placeholder={
                      selectedMethod === "check"
                        ? "e.g. 1042"
                        : "e.g. Transaction ID"
                    }
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount-paid">Amount Paid</Label>
                <Input
                  id="amount-paid"
                  type="number"
                  min="0"
                  max={parseFloat(balanceInDollars)}
                  placeholder="$ 0.00"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                />
              </div>
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This reservation is fully paid. No outstanding balance to collect.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRecordPayment}
            disabled={loading || !hasBalance || !paymentMethod || !isAmountValid}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Recording..." : "Record Payment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

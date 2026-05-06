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
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { useTheme } from "next-themes"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface ManualPaymentDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  totalAmountCents: number
  paidAmountCents: number
  guestId?: string | null
  defaultPaymentMethod?: PaymentMethodValue
  defaultProcessor?: (typeof PROCESSOR_OPTIONS)[number]["value"]
  defaultUseCardOnFile?: boolean
  /** Called after a payment is recorded successfully (before the sheet closes). */
  onSuccess?: () => void
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

type StripeConfirmRefs = {
  stripe: Stripe | null
  elements: ReturnType<typeof useElements> | null
}

function StripePaymentElementSection({
  clientSecret,
  onStripeReady,
}: {
  clientSecret: string
  onStripeReady: (refs: StripeConfirmRefs) => void
}) {
  const stripe = useStripe()
  const elements = useElements()

  useEffect(() => {
    onStripeReady({ stripe: stripe ?? null, elements: elements ?? null })
  }, [stripe, elements, onStripeReady])

  return (
    <div className="space-y-2">
      <Label>Card Details</Label>
      <div className="rounded-md border border-border/80 bg-muted/30 p-3 text-foreground dark:border-zinc-700 dark:bg-zinc-900/70">
        <PaymentElement />
      </div>
    </div>
  )
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
  defaultPaymentMethod,
  defaultProcessor,
  defaultUseCardOnFile,
  onSuccess,
  trigger,
}: ManualPaymentDialogProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [amountDollars, setAmountDollars] = useState("")
  const [reference, setReference] = useState("")
  const [processor, setProcessor] = useState("none")
  const [useCardOnFile, setUseCardOnFile] = useState(false)
  // Balance from financial API (ledger, in cents). May diverge briefly from reservation snapshot.
  const [apiBalance, setApiBalance] = useState<number | null>(null)
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
  const [stripeIntentLoading, setStripeIntentLoading] = useState(false)
  const [stripeConfirmRefs, setStripeConfirmRefs] = useState<StripeConfirmRefs>({
    stripe: null,
    elements: null,
  })
  const { toast } = useToast()
  const isDarkMode = resolvedTheme === "dark"

  // Match reservation ledger "Computed Balance": total_amount − paid_amount on the reservation.
  // If the reservation snapshot is fully paid, always treat it as fully paid in this dialog,
  // even if the financial ledger briefly disagrees (stale/legacy data).
  const snapshotOutstandingCents = Math.max(0, totalAmountCents - paidAmountCents)
  const isSnapshotFullyPaid = snapshotOutstandingCents === 0
  const ledgerOutstandingCents = apiBalance ?? null
  // Only cap to ledger balance if the ledger has activity (apiBalance != null).
  // If the ledger has no activity yet, rely on the reservation snapshot so we don't hide real balances due.
  const cappedOutstandingCents =
    ledgerOutstandingCents == null
      ? snapshotOutstandingCents
      : Math.min(snapshotOutstandingCents, ledgerOutstandingCents)
  const outstandingBalance = isSnapshotFullyPaid ? 0 : cappedOutstandingCents
  const balanceInDollars = (outstandingBalance / 100).toFixed(2)
  const hasBalance = outstandingBalance > 0

  const amountCentsEntered = Math.round(parseFloat(amountDollars || "0") * 100)
  const isAmountValid =
    amountCentsEntered >= 1 && amountCentsEntered <= outstandingBalance

  // Determine if conditional fields should show
  const selectedMethod = paymentMethod as PaymentMethodValue
  const showReference = METHODS_WITH_REFERENCE.has(selectedMethod)
  const showProcessor = METHODS_WITH_PROCESSOR.has(selectedMethod)
  const isStripeCardPayment =
    selectedMethod === "credit_card" && showProcessor && processor === "stripe" && !useCardOnFile

  // Fetch balance from financial API when dialog opens
  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true)
    try {
      const res = await fetch(`/api/v1/financial/reservations/${reservationId}/balance`, {
        credentials: "include",
      })
      const json = await res.json()
      if (json.success && json.data) {
        const data: BalanceData = json.data
        const hasLedgerActivity =
          data.charges_total !== 0 || data.payments_total !== 0 || data.refunds_total !== 0

        if (!hasLedgerActivity) {
          // Ledger has no rows yet; don't override the reservation snapshot.
          setApiBalance(null)
          return
        }

        // Ledger balance (charges − payments − refunds), floored at zero for display caps.
        let ledgerOutstanding = Math.max(0, data.balance)

        // No charge rows yet: API balance is often negative; align with reservation total vs ledger cash.
        if (data.charges_total === 0) {
          ledgerOutstanding = Math.max(
            0,
            totalAmountCents - data.payments_total - data.refunds_total,
          )
        }

        setApiBalance(ledgerOutstanding)
      }
    } catch {
      // Silently fall back to snapshot-only balance (snapshotOutstandingCents)
    } finally {
      setBalanceLoading(false)
    }
  }, [reservationId, totalAmountCents])

  useEffect(() => {
    if (!open) return

    // Reset form state
    setPaymentMethod(defaultPaymentMethod ?? "")
    setReference("")
    setProcessor(defaultProcessor ?? "none")
    setUseCardOnFile(defaultUseCardOnFile ?? false)
    setApiBalance(null)
    setAmountDollars("")
    setStripeClientSecret(null)
    setStripeIntentLoading(false)
    setStripeConfirmRefs({ stripe: null, elements: null })

    // Fetch balance and pre-fill amount
    fetchBalance().then(() => {
      // Will be set after fetchBalance completes and apiBalance is updated
    })
  }, [open, fetchBalance, defaultPaymentMethod, defaultProcessor, defaultUseCardOnFile])

  // Pre-fill amount once balance is available
  useEffect(() => {
    if (!open) return
    const balance = snapshotOutstandingCents === 0 ? 0 : Math.max(snapshotOutstandingCents, apiBalance ?? 0)
    if (balance > 0 && !amountDollars) {
      setAmountDollars((balance / 100).toFixed(2))
    }
  }, [open, apiBalance, snapshotOutstandingCents, amountDollars])

  const fetchStripePaymentIntent = useCallback(
    async (amountCents: number) => {
      setStripeIntentLoading(true)
      try {
        const res = await fetch(
          `/api/v1/financial/reservations/${reservationId}/payment-intent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ amount_cents: amountCents }),
          },
        )
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success || !json?.data?.client_secret) {
          throw new Error(json?.error?.message ?? "Failed to prepare Stripe payment")
        }
        setStripeClientSecret(json.data.client_secret)
      } catch (err) {
        setStripeClientSecret(null)
        setError(err instanceof Error ? err.message : "Failed to prepare Stripe payment")
      } finally {
        setStripeIntentLoading(false)
      }
    },
    [reservationId],
  )

  // Prepare Stripe PaymentIntent when needed (Card + Stripe, not charging card-on-file).
  useEffect(() => {
    if (!open) return
    if (!isStripeCardPayment) {
      setStripeClientSecret(null)
      return
    }
    if (!hasBalance || !isAmountValid) {
      setStripeClientSecret(null)
      return
    }

    const timeout = setTimeout(() => {
      void fetchStripePaymentIntent(amountCentsEntered)
    }, 250)

    return () => clearTimeout(timeout)
  }, [open, isStripeCardPayment, hasBalance, isAmountValid, amountCentsEntered, fetchStripePaymentIntent])

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

      if (isStripeCardPayment) {
        const { stripe, elements } = stripeConfirmRefs
        if (!stripe || !elements) {
          throw new Error("Stripe card form is not ready yet. Please try again.")
        }

        const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
        })

        if (stripeError) {
          throw new Error(stripeError.message ?? "Stripe payment failed")
        }

        if (paymentIntent?.status && paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing") {
          throw new Error(`Payment status: ${paymentIntent.status}`)
        }

        // Record payment immediately so reservation balance + transaction history update,
        // even if the Stripe webhook is delayed or not configured.
        if (paymentIntent?.status === "succeeded") {
          const recordRes = await fetch(`/api/v1/financial/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              reservation_id: reservationId,
              guest_id: guestId ?? null,
              amount_cents: amountCents,
              payment_method: "stripe",
              processor: paymentIntent.id,
              source: "manual",
            }),
          })

          if (!recordRes.ok) {
            const data = await recordRes.json().catch(() => null)
            const message =
              data?.error?.message ??
              data?.error?.details?.message ??
              "Payment succeeded, but failed to record it in CampOS"
            throw new Error(message)
          }
        }

        toast({
          title: "Payment processing",
          description:
            paymentIntent?.status === "succeeded"
              ? "Payment succeeded."
              : "Payment is processing. It will be recorded automatically.",
          variant: "success",
        })
        onSuccess?.()
        setOpen(false)
        router.refresh()
        return
      }

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
      onSuccess?.()
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
                    setStripeClientSecret(null)
                    setStripeConfirmRefs({ stripe: null, elements: null })
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
                <div className="space-y-3">
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
                      onCheckedChange={(checked) => {
                        setUseCardOnFile(checked)
                        setStripeClientSecret(null)
                        setStripeConfirmRefs({ stripe: null, elements: null })
                      }}
                    />
                  </div>

                  {/* Stripe card entry (shown when Processor = Stripe and not using card on file) */}
                  {isStripeCardPayment && (
                    <>
                      {stripeIntentLoading ? (
                        <Alert>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <AlertDescription>Preparing secure card form…</AlertDescription>
                        </Alert>
                      ) : stripeClientSecret ? (
                        <Elements
                          stripe={stripePromise}
                          options={{
                            clientSecret: stripeClientSecret,
                            appearance: {
                              theme: (isDarkMode ? "night" : "stripe") as "night" | "stripe",
                              variables: {
                                colorPrimary: "#ef4444",
                                colorBackground: "transparent",
                                colorText: "currentColor",
                                colorDanger: "#ef4444",
                                fontFamily: "system-ui, sans-serif",
                                borderRadius: "8px",
                              },
                            },
                          }}
                        >
                          <StripePaymentElementSection
                            clientSecret={stripeClientSecret}
                            onStripeReady={setStripeConfirmRefs}
                          />
                        </Elements>
                      ) : (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Enter an amount to load the card form.
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
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

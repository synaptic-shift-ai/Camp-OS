"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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

type GuestPaymentMethod = {
  id: string
  type: string
  card: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  } | null
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
  const [savedCardsLoading, setSavedCardsLoading] = useState(false)
  const [savedCards, setSavedCards] = useState<GuestPaymentMethod[]>([])
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string>("")
  const [useGuestCredit, setUseGuestCredit] = useState(false)
  const [resolvedPropertyId, setResolvedPropertyId] = useState<string | null>(null)
  const [guestCreditBalanceCents, setGuestCreditBalanceCents] = useState<number | null>(null)
  const [guestCreditBalanceLoading, setGuestCreditBalanceLoading] = useState(false)
  const guestCreditSplitPrefilledRef = useRef(false)
  const { toast } = useToast()
  const isDarkMode = resolvedTheme === "dark"

  const snapshotOutstandingCents = Math.max(0, totalAmountCents - paidAmountCents)
  // Prefer API balance when loaded; max() avoids showing $0 if API returned 0 before (?? keeps 0). Props may lag DB.
  const outstandingBalance =
    apiBalance === null
      ? snapshotOutstandingCents
      : Math.max(snapshotOutstandingCents, apiBalance)
  const balanceInDollars = (outstandingBalance / 100).toFixed(2)
  const hasBalance = outstandingBalance > 0

  /** Guest credit applied when toggle is on: min(available, outstanding), after balance is known. */
  const guestCreditAppliedCents =
    useGuestCredit &&
    !guestCreditBalanceLoading &&
    guestCreditBalanceCents !== null &&
    guestCreditBalanceCents > 0
      ? Math.min(outstandingBalance, guestCreditBalanceCents)
      : 0

  const cashInputCents = useGuestCredit
    ? Math.round(parseFloat(amountDollars || "0") * 100)
    : Math.round(parseFloat(amountDollars || "0") * 100)

  const remainingAfterGuestCreditCents = useGuestCredit
    ? Math.max(0, outstandingBalance - guestCreditAppliedCents)
    : outstandingBalance

  const showCashCollectSection = !useGuestCredit || remainingAfterGuestCreditCents > 0

  const maxCashAfterGuestCents = Math.max(0, outstandingBalance - guestCreditAppliedCents)

  const totalPaymentCents = guestCreditAppliedCents + cashInputCents

  const guestCreditAmountValid =
    !useGuestCredit ||
    (!guestCreditBalanceLoading && guestCreditBalanceCents !== null)

  const cashAmountValid =
    !useGuestCredit ||
    (cashInputCents >= 0 && cashInputCents <= maxCashAfterGuestCents)

  const paymentMethodOk =
    !useGuestCredit ||
    cashInputCents < 1 ||
    (typeof paymentMethod === "string" && paymentMethod.length > 0)

  const isAmountValid =
    totalPaymentCents >= 1 &&
    guestCreditAmountValid &&
    cashAmountValid &&
    paymentMethodOk &&
    (!useGuestCredit ? cashInputCents <= outstandingBalance : true)

  const stripeIntentAmountCents = cashInputCents

  // Determine if conditional fields should show
  const selectedMethod = paymentMethod as PaymentMethodValue
  const showReference = METHODS_WITH_REFERENCE.has(selectedMethod)
  const showProcessor = METHODS_WITH_PROCESSOR.has(selectedMethod)
  const isStripeCardPayment =
    selectedMethod === "credit_card" &&
    showProcessor &&
    processor === "stripe" &&
    !useCardOnFile &&
    (!useGuestCredit || cashInputCents > 0)
  const isStripeSavedCardPayment =
    selectedMethod === "credit_card" &&
    showProcessor &&
    processor === "stripe" &&
    useCardOnFile &&
    !useGuestCredit

  const paymentMethodRequired = !useGuestCredit || cashInputCents > 0

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
        const apiBal = Math.max(0, data.balance)
        const snapshotFromProps = Math.max(0, totalAmountCents - paidAmountCents)
        const ledgerLineSumCents = data.charges_total - data.payments_total - data.refunds_total
        const displayedOutstandingCents = Math.max(snapshotFromProps, apiBal)

        if (
          displayedOutstandingCents !== snapshotFromProps ||
          data.balance !== snapshotFromProps ||
          ledgerLineSumCents !== snapshotFromProps
        ) {
          console.warn('[ManualPaymentDialog] Outstanding balance breakdown', {
            reservationId,
            charges_total_cents: data.charges_total,
            payments_total_cents: data.payments_total,
            refunds_total_cents: data.refunds_total,
            ledger_line_sum_cents: ledgerLineSumCents,
            server_balance_cents: data.balance,
            dialog_parent_props_snapshot_due_cents: snapshotFromProps,
            displayed_outstanding_cents: displayedOutstandingCents,
            note:
              ledgerLineSumCents !== data.balance
                ? 'Ledger line sum can exceed reservation total_amount (duplicate or extra charge rows). Amount due from API uses reservation total minus paid when total_amount > 0.'
                : undefined,
            props_may_be_stale:
              snapshotFromProps !== data.balance
                ? 'API balance differs from dialog props snapshot; parent totalAmountCents/paidAmountCents may not match DB yet.'
                : undefined,
          })
        }

        setApiBalance(apiBal)
      }
      const resProp = await fetch(`/api/v1/reservations/${reservationId}`, { credentials: "include" })
      const jsonProp = await resProp.json().catch(() => null)
      const pid = jsonProp?.data?.property_id as string | undefined
      if (typeof pid === "string" && pid.length > 0) {
        setResolvedPropertyId((prev) => prev ?? pid)
      }
    } catch {
      // Silently fall back to snapshot-only balance (snapshotOutstandingCents)
    } finally {
      setBalanceLoading(false)
    }
  }, [reservationId, totalAmountCents, paidAmountCents])

  const fetchSavedCards = useCallback(async () => {
    if (!guestId) return
    setSavedCardsLoading(true)
    try {
      const res = await fetch(`/api/v1/reservations/${reservationId}`, { credentials: "include" })
      const json = await res.json().catch(() => null)
      const propertyId = json?.data?.property_id as string | undefined
      if (!propertyId) return
      setResolvedPropertyId(propertyId)

      const params = new URLSearchParams({ property_id: propertyId, guest_id: guestId })
      const pmRes = await fetch(`/api/v1/guest/payment-methods?${params.toString()}`, {
        credentials: "include",
      })
      const pmJson = await pmRes.json().catch(() => null)
      const list = (pmJson?.data?.payment_methods ?? pmJson?.payment_methods ?? []) as GuestPaymentMethod[]
      setSavedCards(Array.isArray(list) ? list : [])
      const firstCardId = Array.isArray(list) && list.length > 0 ? list[0]?.id : ""
      setSelectedSavedCardId((prev) => prev || (typeof firstCardId === "string" ? firstCardId : ""))
    } catch {
      setSavedCards([])
    } finally {
      setSavedCardsLoading(false)
    }
  }, [guestId, reservationId])

  useEffect(() => {
    if (!open) return

    // Reset form state
    setPaymentMethod(defaultPaymentMethod ?? "")
    setReference("")
    setProcessor(defaultProcessor ?? "none")
    setUseCardOnFile(defaultUseCardOnFile ?? false)
    setApiBalance(null)
    setAmountDollars("")
    guestCreditSplitPrefilledRef.current = false
    setStripeClientSecret(null)
    setStripeIntentLoading(false)
    setStripeConfirmRefs({ stripe: null, elements: null })
    setSavedCards([])
    setSelectedSavedCardId("")
    setUseGuestCredit(false)
    setResolvedPropertyId(null)
    setGuestCreditBalanceCents(null)
    setGuestCreditBalanceLoading(false)

    // Fetch balance and pre-fill amount
    fetchBalance().then(() => {
      // Will be set after fetchBalance completes and apiBalance is updated
    })
    void fetchSavedCards()
  }, [open, fetchBalance, fetchSavedCards, defaultPaymentMethod, defaultProcessor, defaultUseCardOnFile])

  // Pre-fill amount once balance is available (single-field mode only)
  useEffect(() => {
    if (!open || useGuestCredit) return
    const balance =
      apiBalance === null
        ? snapshotOutstandingCents
        : Math.max(snapshotOutstandingCents, apiBalance)
    if (balance > 0 && !amountDollars) {
      setAmountDollars((balance / 100).toFixed(2))
    }
  }, [open, apiBalance, snapshotOutstandingCents, amountDollars, useGuestCredit])

  useEffect(() => {
    if (!useGuestCredit) guestCreditSplitPrefilledRef.current = false
  }, [useGuestCredit])

  useEffect(() => {
    if (!open || !useGuestCredit) return
    if (guestCreditBalanceLoading) return
    if (guestCreditBalanceCents === null) return
    const cap = Math.min(outstandingBalance, Math.max(0, guestCreditBalanceCents))
    if (cap < 1) return
    if (guestCreditSplitPrefilledRef.current) return
    guestCreditSplitPrefilledRef.current = true
    setAmountDollars((Math.max(0, outstandingBalance - cap) / 100).toFixed(2))
  }, [
    open,
    useGuestCredit,
    guestCreditBalanceLoading,
    guestCreditBalanceCents,
    outstandingBalance,
  ])

  useEffect(() => {
    if (!open || !guestId || !resolvedPropertyId) {
      return
    }
    let cancelled = false
    setGuestCreditBalanceLoading(true)
    void (async () => {
      try {
        const params = new URLSearchParams({ propertyId: resolvedPropertyId })
        const res = await fetch(
          `/api/v1/financial/guests/${guestId}/credit-balance?${params.toString()}`,
          { credentials: "include" },
        )
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok && json?.success && json?.data && typeof json.data.credit_balance_cents === "number") {
          setGuestCreditBalanceCents(json.data.credit_balance_cents)
        } else {
          setGuestCreditBalanceCents(0)
        }
      } catch {
        if (!cancelled) setGuestCreditBalanceCents(null)
      } finally {
        if (!cancelled) setGuestCreditBalanceLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, guestId, resolvedPropertyId])

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
      void fetchStripePaymentIntent(stripeIntentAmountCents)
    }, 250)

    return () => clearTimeout(timeout)
  }, [open, isStripeCardPayment, hasBalance, isAmountValid, stripeIntentAmountCents, fetchStripePaymentIntent])

  const handleRecordPayment = async () => {
    const gcCents =
      useGuestCredit &&
      !guestCreditBalanceLoading &&
      guestCreditBalanceCents !== null &&
      guestCreditBalanceCents > 0
        ? Math.min(outstandingBalance, guestCreditBalanceCents)
        : 0
    const cashCents = useGuestCredit
      ? Math.round(parseFloat(amountDollars || "0") * 100)
      : Math.round(parseFloat(amountDollars || "0") * 100)

    if (paymentMethodRequired && !paymentMethod) {
      setError(
        useGuestCredit && cashCents > 0
          ? "Select a payment method for the additional amount"
          : "Select a payment method",
      )
      return
    }

    if (gcCents + cashCents < 1) {
      setError("Amount must be greater than 0")
      return
    }

    if (useGuestCredit) {
      if (!guestId) {
        setError("Guest is required to apply guest credit")
        return
      }
      if (guestCreditBalanceLoading) {
        setError("Guest credit balance is still loading. Please wait.")
        return
      }
      if (gcCents < 0 || cashCents < 0) {
        setError("Amounts cannot be negative")
        return
      }
      const maxCash = Math.max(0, outstandingBalance - gcCents)
      if (cashCents > maxCash) {
        setError(
          `Additional payment cannot exceed $${(maxCash / 100).toFixed(2)} remaining after guest credit`,
        )
        return
      }
    } else if (cashCents > outstandingBalance) {
      setError(`Amount cannot exceed outstanding balance ($${balanceInDollars})`)
      return
    }

    const cashToCollect = cashCents

    try {
      setLoading(true)
      setError(null)

      if (useGuestCredit && gcCents > 0) {
        const response = await fetch(`/api/v1/financial/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            reservation_id: reservationId,
            guest_id: guestId,
            amount_cents: gcCents,
            payment_method: "store_credit",
            processor: null,
            source: "guest_credit",
          }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          const message =
            data?.error?.message ??
            data?.error?.details?.message ??
            "Failed to record guest credit payment"
          throw new Error(message)
        }
      }

      if (cashToCollect < 1) {
        if (useGuestCredit && gcCents > 0) {
          toast({
            title: "Payment recorded",
            description: "Guest credit has been applied to this reservation.",
            variant: "success",
          })
          onSuccess?.()
          setOpen(false)
          router.refresh()
        }
        return
      }

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

        if (paymentIntent?.status === "succeeded") {
          const recordRes = await fetch(`/api/v1/financial/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              reservation_id: reservationId,
              guest_id: guestId ?? null,
              amount_cents: cashToCollect,
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
              ? useGuestCredit && gcCents > 0
                ? "Guest credit and card payment recorded."
                : "Payment succeeded."
              : "Payment is processing. It will be recorded automatically.",
          variant: "success",
        })
        onSuccess?.()
        setOpen(false)
        router.refresh()
        return
      }

      if (isStripeSavedCardPayment) {
        const response = await fetch(`/api/v1/financial/reservations/${reservationId}/charge-balance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amount_cents: cashToCollect,
            ...(selectedSavedCardId ? { payment_method_id: selectedSavedCardId } : {}),
          }),
        })

        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.success) {
          const message =
            data?.error?.message ?? data?.error?.details?.message ?? "Failed to charge card on file"
          throw new Error(message)
        }

        toast({
          title: "Payment recorded",
          description: "Card on file has been charged successfully.",
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
          amount_cents: cashToCollect,
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
        description:
          useGuestCredit && gcCents > 0
            ? "Guest credit and additional payment have been recorded."
            : "Manual payment has been recorded successfully.",
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

              {guestId ? (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="manual-payment-use-guest-credit" className="text-sm">
                      Use guest credit
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Apply available guest credit toward this balance (store credit payment).
                    </p>
                    <p className="text-xs font-medium text-foreground">
                      {!resolvedPropertyId || guestCreditBalanceLoading ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          Loading guest credit…
                        </span>
                      ) : typeof guestCreditBalanceCents === "number" ? (
                        <>
                          Guest credit:{" "}
                          <span className="tabular-nums">${(guestCreditBalanceCents / 100).toFixed(2)}</span>
                          {useGuestCredit && guestCreditAppliedCents > 0 ? (
                            <>
                              {" "}
                              <span className="text-muted-foreground">·</span> Applying:{" "}
                              <span className="tabular-nums">
                                ${(guestCreditAppliedCents / 100).toFixed(2)}
                              </span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unable to load guest credit.</span>
                      )}
                    </p>
                  </div>
                  <Switch
                    id="manual-payment-use-guest-credit"
                    checked={useGuestCredit}
                    onCheckedChange={(checked) => {
                      const on = Boolean(checked)
                      setUseGuestCredit(on)
                      if (on) {
                        guestCreditSplitPrefilledRef.current = false
                        setPaymentMethod("")
                        setReference("")
                        setProcessor("none")
                        setUseCardOnFile(false)
                        setStripeClientSecret(null)
                        setStripeConfirmRefs({ stripe: null, elements: null })
                        const canSplitNow =
                          Boolean(guestId) &&
                          typeof guestCreditBalanceCents === "number" &&
                          guestCreditBalanceCents >= 1 &&
                          !guestCreditBalanceLoading &&
                          outstandingBalance > 0
                        if (canSplitNow) {
                          const cap = Math.min(outstandingBalance, guestCreditBalanceCents)
                          if (cap >= 1) {
                            guestCreditSplitPrefilledRef.current = true
                            setAmountDollars((Math.max(0, outstandingBalance - cap) / 100).toFixed(2))
                          }
                        } else if (guestId) {
                          setAmountDollars("")
                        }
                      } else {
                        guestCreditSplitPrefilledRef.current = false
                        setPaymentMethod(defaultPaymentMethod ?? "")
                        setAmountDollars((outstandingBalance / 100).toFixed(2))
                      }
                    }}
                    disabled={loading}
                  />
                </div>
              ) : null}

              {showCashCollectSection ? (
              <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manual-payment-method">
                  {useGuestCredit ? "Collect remaining balance" : "Collect Payment"}
                </Label>
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
                            {method.label} — $
                            {useGuestCredit
                              ? (remainingAfterGuestCreditCents / 100).toFixed(2)
                              : balanceInDollars}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Processor select — shown for Card payments */}
              {showCashCollectSection && showProcessor && (
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
              {showCashCollectSection && showProcessor && (
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

                  {useCardOnFile && processor === "stripe" ? (
                    <div className="space-y-2">
                      <Label>Saved cards</Label>
                      <Select
                        value={selectedSavedCardId}
                        onValueChange={setSelectedSavedCardId}
                        disabled={savedCardsLoading || loading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={savedCardsLoading ? "Loading cards…" : "Select a saved card..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {savedCards.map((pm) => (
                            <SelectItem key={pm.id} value={pm.id}>
                              {pm.card
                                ? `${pm.card.brand.toUpperCase()} •••• ${pm.card.last4} (exp ${pm.card.exp_month}/${String(pm.card.exp_year).slice(-2)})`
                                : pm.type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Enter the amount to charge below (up to the outstanding balance of ${balanceInDollars}).
                      </p>
                    </div>
                  ) : null}

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
                            {useGuestCredit
                              ? "Enter the additional payment amount to load the card form."
                              : "Enter an amount to load the card form."}
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Reference input — shown for Check and ACH */}
              {showCashCollectSection && showReference && (
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
                  max={
                    useGuestCredit
                      ? maxCashAfterGuestCents / 100
                      : parseFloat(balanceInDollars)
                  }
                  step="0.01"
                  placeholder="$ 0.00"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  disabled={loading}
                />
              </div>
              </div>
              ) : useGuestCredit ? (
                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    Guest credit covers the full outstanding balance. Record payment to apply guest credit only.
                  </AlertDescription>
                </Alert>
              ) : null}
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
            disabled={
              loading ||
              !hasBalance ||
              !isAmountValid ||
              (useGuestCredit && (!guestId || guestCreditBalanceLoading))
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Recording..." : "Record Payment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

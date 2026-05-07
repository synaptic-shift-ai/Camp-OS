"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, DollarSign, Info, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { IssueRefundRequest } from "@/types/api/v1/schemas/reservations"

const REFUND_REASONS: { value: IssueRefundRequest["reason"]; label: string }[] = [
  { value: "partial_cancellation", label: "Partial cancellation" },
  { value: "cancellation", label: "Cancellation" },
  { value: "service_issue", label: "Service issue" },
  { value: "overbooking", label: "Overbooking" },
  { value: "weather", label: "Weather" },
  { value: "other", label: "Other" },
]

type RefundHandling = "original_method" | "guest_credit"

interface RefundReservationDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  maxRefundableCents: number
  guestId?: string
  propertyId?: string
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function RefundReservationDialog({
  reservationId,
  confirmationNumber,
  guestName,
  maxRefundableCents,
  guestId,
  propertyId,
  trigger,
  onSuccess,
}: RefundReservationDialogProps) {
  const [open, setOpen] = useState(false)
  const [amountDollars, setAmountDollars] = useState("")
  const [reason, setReason] = useState<IssueRefundRequest["reason"] | "">("")
  const [refundPaymentMethod, setRefundPaymentMethod] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null)
  const [eligibilityLoading, setEligibilityLoading] = useState(false)

  // New state for refund handling
  const [handling, setHandling] = useState<RefundHandling>("original_method")
  const [creditBalanceLoading, setCreditBalanceLoading] = useState(false)
  const [creditBalanceCents, setCreditBalanceCents] = useState<number | null>(null)
  const [resolvedGuestId, setResolvedGuestId] = useState<string | null>(null)
  const [resolvedPropertyId, setResolvedPropertyId] = useState<string | null>(null)
  // First completed payment ID (needed for guest_credit v2 API)
  const [paymentId, setPaymentId] = useState<string | null>(null)

  const router = useRouter()

  const maxRefundDollars = maxRefundableCents > 0 ? (maxRefundableCents / 100).toFixed(2) : "0.00"

  // Format cents to dollars string
  const formatCentsToDollars = useCallback((cents: number) => {
    return (cents / 100).toFixed(2)
  }, [])

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      // Reset state on close
      setEligibilityMessage(null)
      setEligibilityLoading(false)
      setCreditBalanceCents(null)
      setCreditBalanceLoading(false)
      setResolvedGuestId(null)
      setResolvedPropertyId(null)
      setPaymentId(null)
      setAmountDollars("")
      setReason("")
      setRefundPaymentMethod("")
      setHandling("original_method")
      setError(null)
      return
    }

    // On open: fetch eligibility + payment ID for guest credit
    setEligibilityLoading(true)
    try {
      const response = await fetch(`/api/v1/reservations/${reservationId}`)
      const data = await response.json()
      const message = data?.data?.refund_eligibility?.message
      setEligibilityMessage(typeof message === "string" && message.length > 0 ? message : null)
      const apiGuestId = data?.data?.guest_id
      const apiPropertyId = data?.data?.property_id
      console.debug("[RefundReservationDialog] Resolved IDs from reservation API", {
        reservationId,
        apiGuestId,
        apiPropertyId,
      })
      setResolvedGuestId(typeof apiGuestId === "string" && apiGuestId.length > 0 ? apiGuestId : null)
      setResolvedPropertyId(typeof apiPropertyId === "string" && apiPropertyId.length > 0 ? apiPropertyId : null)
    } catch {
      setEligibilityMessage(null)
      setResolvedGuestId(null)
      setResolvedPropertyId(null)
    } finally {
      setEligibilityLoading(false)
    }

    // Pre-fill amount with max refundable
    if (maxRefundableCents > 0) {
      setAmountDollars(formatCentsToDollars(maxRefundableCents))
    }
  }

  // Fetch guest credit balance when handling changes to guest_credit
  useEffect(() => {
    if (!open || handling !== "guest_credit") return

    const effectiveGuestId = guestId ?? resolvedGuestId
    const effectivePropertyId = propertyId ?? resolvedPropertyId
    console.debug("[RefundReservationDialog] Guest credit fetch prerequisites", {
      reservationId,
      guestIdProp: guestId ?? null,
      propertyIdProp: propertyId ?? null,
      resolvedGuestId,
      resolvedPropertyId,
      effectiveGuestId,
      effectivePropertyId,
    })

    const fetchCreditBalance = async () => {
      setCreditBalanceLoading(true)
      setCreditBalanceCents(null)
      try {
        const params = new URLSearchParams()
        if (effectivePropertyId) params.set("propertyId", effectivePropertyId)

        const url = `/api/v1/financial/guests/${effectiveGuestId}/credit-balance?${params}`
        console.debug("[RefundReservationDialog] Fetching guest credit balance", { url })
        const res = await fetch(
          url,
        )
        const json = await res.json().catch(() => null)
        console.debug("[RefundReservationDialog] Guest credit balance response", {
          ok: res.ok,
          status: res.status,
          json,
        })
        if (res.ok && json?.success && json?.data && typeof json.data.credit_balance_cents === "number") {
          setCreditBalanceCents(json.data.credit_balance_cents)
        }
      } catch (err) {
        // Silently fail — credit balance is informational
        console.debug("[RefundReservationDialog] Guest credit balance fetch failed", err)
      } finally {
        setCreditBalanceLoading(false)
      }
    }

    const fetchPaymentId = async () => {
      try {
        const res = await fetch(
          `/api/v1/financial/reservations/${reservationId}/transactions?pageSize=1&type=payment`,
        )
        const json = await res.json()
        if (json.success && json.data?.transactions?.length > 0) {
          setPaymentId(json.data.transactions[0].id)
        }
      } catch {
        // Silently fail
      }
    }

    if (effectiveGuestId && effectivePropertyId) void fetchCreditBalance()
    else {
      setCreditBalanceLoading(false)
      setCreditBalanceCents(null)
    }
    fetchPaymentId()
  }, [open, handling, guestId, propertyId, resolvedGuestId, resolvedPropertyId, reservationId])

  const handleRefund = async () => {
    try {
      setLoading(true)
      setError(null)

      const amountCents = Math.round(parseFloat(amountDollars || "0") * 100)
      if (amountCents < 1) {
        setError("Refund amount must be at least $0.01")
        setLoading(false)
        return
      }
      if (amountCents > maxRefundableCents) {
        setError(`Refund amount cannot exceed $${maxRefundDollars}`)
        setLoading(false)
        return
      }
      if (!reason || !REFUND_REASONS.some((r) => r.value === reason)) {
        setError("Please select a refund reason")
        setLoading(false)
        return
      }

      if (handling === "guest_credit") {
        // V2 API: requires payment_id
        if (!paymentId) {
          setError("No completed payment found for this reservation. Cannot issue guest credit refund.")
          setLoading(false)
          return
        }

        const response = await fetch(`/api/v1/financial/refunds`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_id: paymentId,
            amount_cents: amountCents,
            handling: "guest_credit" as const,
            reason: reason || undefined,
          }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          const message =
            data?.error?.message ?? data?.error?.details?.message ?? "Failed to issue refund"
          throw new Error(message)
        }

        setOpen(false)
        router.refresh()
        onSuccess?.()
      } else {
        // Original method: use v1 schema via financial refunds endpoint
        if (!refundPaymentMethod) {
          setError("Please select a refund method")
          setLoading(false)
          return
        }

        // Map UI method values to API enum
        const methodMap: Record<string, string> = {
          check: "check",
          cash: "cash",
          card: "credit_card",
        }
        const apiMethod = methodMap[refundPaymentMethod] ?? "stripe"

        const response = await fetch(`/api/v1/financial/refunds`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservationId,
            amountCents,
            paymentMethod: apiMethod,
            reason: reason || undefined,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          const errorPayload = data?.error ?? data
          const details = errorPayload?.details as { errors?: Array<{ path?: string[]; message?: string }> } | undefined
          const errorMessage =
            details?.errors?.length
              ? `Validation failed: ${details.errors.map((e) => e.message ?? String(e)).join(", ")}`
              : errorPayload?.message ?? "Failed to issue refund"
          throw new Error(errorMessage)
        }

        setOpen(false)
        router.refresh()
        onSuccess?.()
      }
    } catch (err) {
      console.error("Refund reservation error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const isFormValid =
    !loading &&
    maxRefundableCents > 0 &&
    reason !== "" &&
    REFUND_REASONS.some((r) => r.value === reason) &&
    (handling === "guest_credit" ? !!paymentId : !!refundPaymentMethod) &&
    parseFloat(amountDollars || "0") > 0

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { void handleOpenChange(nextOpen) }}>
      <SheetTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm">Issue Refund</Button>}
      </SheetTrigger>
      <SheetContent className="w-[90vw] max-w-[90vw]">
        <SheetHeader>
          <SheetTitle>Issue Refund</SheetTitle>
          <SheetDescription>
            Issue an additional refund for this cancelled reservation. Amount cannot exceed the remaining refundable balance.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Confirmation:</span>{" "}
              <span className="text-muted-foreground">{confirmationNumber}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Guest:</span>{" "}
              <span className="text-muted-foreground capitalize">{guestName}</span>
            </div>
          </div>

          {eligibilityLoading ? (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Checking refund eligibility...</AlertDescription>
            </Alert>
          ) : eligibilityMessage ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{eligibilityMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label>Remaining Amount To be Refunded</Label>
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">
                  Remaining Amount To be Refunded: ${maxRefundDollars}
                </span>
              </AlertDescription>
            </Alert>
          </div>

          {/* Refund handling radio group */}
          <div className="space-y-3">
            <Label>Refund Handling</Label>
            <RadioGroup
              value={handling}
              onValueChange={(v) => setHandling(v as RefundHandling)}
              disabled={loading}
            >
              <div className="flex items-start space-x-3 space-y-0">
                <RadioGroupItem value="original_method" id="handling-original" className="mt-0.5" />
                <Label htmlFor="handling-original" className="font-normal cursor-pointer">
                  <div className="text-sm font-medium">Original Method</div>
                  <p className="text-xs text-muted-foreground">
                    Refund to the original payment method (e.g., card, check, cash)
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 space-y-0">
                <RadioGroupItem value="guest_credit" id="handling-guest-credit" className="mt-0.5" />
                <Label htmlFor="handling-guest-credit" className="font-normal cursor-pointer">
                  <div className="text-sm font-medium">Guest Credit</div>
                  <p className="text-xs text-muted-foreground">
                    Issue as a credit the guest can apply to future reservations
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Guest credit info alert */}
          {handling === "guest_credit" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                The refund will be issued as a guest credit that can be applied to future reservations at this property.
                {creditBalanceLoading && (
                  <span className="ml-1 inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading credit balance…
                  </span>
                )}
                {!creditBalanceLoading && creditBalanceCents !== null && (
                  <span className="ml-1 font-medium">
                    Current credit balance: ${formatCentsToDollars(creditBalanceCents)}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Original method: refund method select */}
          {handling === "original_method" && (
            <div className="space-y-2">
              <Label>Refund method</Label>
              <Select
                value={refundPaymentMethod}
                onValueChange={setRefundPaymentMethod}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select refund method..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="refund-amount">Refund amount</Label>
            <Input
              id="refund-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder={maxRefundDollars ? `Max $${maxRefundDollars}` : "$0.00"}
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Maximum refundable: ${maxRefundDollars}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Refund reason</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as IssueRefundRequest["reason"])}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            onClick={handleRefund}
            disabled={!isFormValid}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Processing..." : "Issue Refund"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

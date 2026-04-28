"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { isAccessDeniedError } from "@/lib/utils/is-access-denied-error"
import { useRouter } from "next/navigation"
import { DollarSign } from "lucide-react"
import {
  AmericanExpressFlatRoundedIcon,
  DiscoverFlatRoundedIcon,
  GenericFlatRoundedIcon,
  MastercardFlatRoundedIcon,
  VisaFlatRoundedIcon,
} from "react-svg-credit-card-payment-icons"

function PaymentCardLogo({ brand }: { brand: string }) {
  const normalized = brand.trim().toLowerCase()
  switch (normalized) {
    case "visa":
      return <VisaFlatRoundedIcon width={56} />
    case "mastercard":
      return <MastercardFlatRoundedIcon width={56} />
    case "amex":
    case "american express":
    case "americanexpress":
      return <AmericanExpressFlatRoundedIcon width={56} />
    case "discover":
      return <DiscoverFlatRoundedIcon width={56} />
    default:
      return <GenericFlatRoundedIcon width={56} />
  }
}

interface CancelReservationDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  paidAmountCents: number
  trigger?: React.ReactNode
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function CancelReservationDialog({
  reservationId,
  confirmationNumber,
  guestName,
  paidAmountCents,
  trigger,
}: CancelReservationDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [refundAmountDollars, setRefundAmountDollars] = useState("")
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestedRefundCents, setSuggestedRefundCents] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [paymentCard, setPaymentCard] = useState<{
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  } | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const maxRefundDollars = paidAmountCents != null ? (paidAmountCents / 100).toFixed(2) : null
  const suggestedRefundDollars =
    suggestedRefundCents != null ? (suggestedRefundCents / 100).toFixed(2) : null
  const amountToRefundDollars = suggestedRefundDollars ?? maxRefundDollars

  useEffect(() => {
    if (!open || !reservationId) return
    setPreviewLoading(true)
    setSuggestedRefundCents(null)
    setPaymentCard(null)
    fetch(`/api/v1/reservations/${reservationId}`)
      .then((res) => res.json())
      .then((json) => {
        const cents = json?.data?.suggested_refund_cents
        if (json?.success === true && typeof cents === "number") {
          setSuggestedRefundCents(cents)
          setRefundAmountDollars((cents / 100).toFixed(2))
        } else {
          setRefundAmountDollars(maxRefundDollars ?? "")
        }
        const pc = json?.data?.payment_card
        if (
          json?.success === true &&
          pc &&
          typeof pc.last4 === "string" &&
          typeof pc.brand === "string" &&
          typeof pc.exp_month === "number" &&
          typeof pc.exp_year === "number"
        ) {
          setPaymentCard({
            brand: pc.brand,
            last4: pc.last4,
            exp_month: pc.exp_month,
            exp_year: pc.exp_year,
          })
        }
      })
      .catch(() => {
        setRefundAmountDollars(maxRefundDollars ?? "")
      })
      .finally(() => setPreviewLoading(false))
  }, [open, reservationId, maxRefundDollars])

  const handleCancel = async () => {
    try {
      setLoading(true)
      setError(null)

      const refundAmountCents = Math.round(parseFloat(refundAmountDollars || "0") * 100)
      if (refundAmountCents < 0) {
        setError("Refund amount cannot be negative")
        setLoading(false)
        return
      }

      if (paidAmountCents != null && refundAmountCents > paidAmountCents) {
        setError(`Refund amount cannot exceed amount paid ($${maxRefundDollars})`)
        setLoading(false)
        return
      }

      const trimmedReason = reason.trim() || undefined

      // const reasonWithMethod = [
      //   reason.trim(),
      //   refundPaymentMethod && refundAmountCents > 0
      //     ? `Refunded $${(refundAmountCents / 100).toFixed(2)} via ${refundPaymentMethod}`
      //     : "",
      // ]
      //   .filter(Boolean)
      //   .join(", ") || undefined

      // API requires refundAmountCents; 0 = no refund (backend may override per policy)
      const requestBody = {
        reason: trimmedReason,
        refundAmountCents,
        refundPaymentMethod: refundPaymentMethod ?? undefined,
      }
      console.log("[Cancel Reservation] Sending request", { reservationId, requestBody })

      const response = await fetch(
        `/api/v1/reservations/${reservationId}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        // For server errors, show a simple, specific message
        if (response.status === 500) {
          setError(
            "Failed to cancel reservation. Can't find PaymentIntent ID in Stripe. Choose different refund method."
          )
          return
        }

        const errorPayload = data?.error ?? data
        const details = errorPayload?.details as
          | { errors?: Array<{ path?: string[]; message?: string }>; message?: string }
          | undefined
        console.warn("[Cancel Reservation] API error response", {
          status: response.status,
          statusText: response.statusText,
          data,
        })
        const baseMessage = errorPayload?.message ?? "Failed to cancel reservation"
        const errorMessage =
          details?.errors?.length
            ? `Validation failed: ${details.errors.map((e) => e.message ?? String(e)).join(", ")}`
            : typeof details?.message === "string" && details.message.length > 0
              ? `${baseMessage} ${details.message}`
              : baseMessage
        throw new Error(errorMessage)
      }

      // Success - close dialog and refresh the page
      toast({
        title: "Reservation cancelled",
        description: "The reservation has been cancelled successfully.",
        variant: "success",
      })
      handleOpenChange(false)
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
      console.error("Cancel reservation error:", err)
      toast({
        title: "Cancellation failed",
        description: err instanceof Error ? err.message : "An unexpected error occurred",
        variant: "destructive",
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSuggestedRefundCents(null)
      setRefundAmountDollars("")
      setError(null)
      setPaymentCard(null)
    }
    setOpen(nextOpen)
  }

  const isRefundable = suggestedRefundCents != null && suggestedRefundCents > 0

  const refundMessage =
    suggestedRefundCents != null && paidAmountCents > 0
      ? suggestedRefundCents >= paidAmountCents
        ? 'Your Cancellation is Eligible for full refund.'
        : suggestedRefundCents > 0
          ? `Your Cancellation is Eligible for ${Math.round((suggestedRefundCents / paidAmountCents) * 100)}% refund.`
          : null
      : null

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger || <Button variant="destructive" size="sm">Cancel Reservation</Button>}
      </SheetTrigger>
      <SheetContent className="w-[90vw] max-w-[90vw] flex max-h-[100dvh] flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Cancel Reservation</SheetTitle>
          <SheetDescription>
            Are you sure you want to cancel this reservation? This action cannot be undone.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Reservation Details */}
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Confirmation:</span>{" "}
              <span className="text-muted-foreground">{confirmationNumber}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Guest:</span>{" "}
              <span className="text-muted-foreground">{guestName}</span>
            </div>
            <div className="flex flex-nowrap items-center gap-2 text-sm">
              <span className="font-medium shrink-0">Payment card:</span>
              {previewLoading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : paymentCard ? (
                <span className="inline-flex min-w-0 items-center gap-3 align-middle">
                  <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center">
                    <PaymentCardLogo brand={paymentCard.brand} />
                  </span>
                  <span className="min-w-0 truncate font-mono text-base text-foreground">
                    **** **** **** {paymentCard.last4}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  No card payment on file for this booking
                </span>
              )}
            </div>
          </div>

          {previewLoading ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span>Checking refund eligibility...</span>
            </div>
          ) : isRefundable ? (
            <>
              <div className="space-y-2">
                <Label>Amount To be Refunded</Label>
                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-semibold">
                      Amount To be Refunded: ${amountToRefundDollars ?? "0.00"}
                    </span>
                    {suggestedRefundDollars != null && (
                      <span className="block text-sm text-muted-foreground mt-1">
                        {refundMessage}
                        {/* Per cancellation policy. You may adjust below (max ${maxRefundDollars}). */}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              </div>

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

              {/* Refund Amount */}
              <div className="space-y-2">
                <Label htmlFor="refund-amount">Refund Amount</Label>
                <Input
                  id="refundAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={maxRefundDollars != null ? `Max $${maxRefundDollars}` : "$0.00"}
                  value={refundAmountDollars}
                  onChange={(e) => setRefundAmountDollars(e.target.value)}
                  disabled={loading}
                />
                {maxRefundDollars != null && (
                  <p className="text-xs text-muted-foreground">
                    {suggestedRefundDollars != null
                      ? `Per policy: $${suggestedRefundDollars}. Maximum: $${maxRefundDollars} (amount paid).`
                      : `Maximum refund amount is $${maxRefundDollars} (amount paid).`}
                  </p>
                )}
              </div>
            </>
          ) : paidAmountCents > 0 ? (
            <Alert>
              <AlertDescription>
                Your Cancellation is not eligible for a refund due to late cancellation.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Cancellation Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Guest requested cancellation, Weather conditions, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              This reason will be saved in the reservation notes.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Warning */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The guest will need to be notified manually about this cancellation.
              Email notifications will be added in a future update.
            </AlertDescription>
          </Alert>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Keep Reservation
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={loading || (isRefundable && !refundPaymentMethod)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Cancelling..." : "Cancel Reservation"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}

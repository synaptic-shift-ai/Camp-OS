"use client"

import { useState } from "react"
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
import { AlertCircle, DollarSign, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
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

interface RefundReservationDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  maxRefundableCents: number
  trigger?: React.ReactNode
}

export function RefundReservationDialog({
  reservationId,
  confirmationNumber,
  guestName,
  maxRefundableCents,
  trigger,
}: RefundReservationDialogProps) {
  const [open, setOpen] = useState(false)
  const [amountDollars, setAmountDollars] = useState("")
  const [reason, setReason] = useState<IssueRefundRequest["reason"] | "">("")
  const [refundPaymentMethod, setRefundPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null)
  const [eligibilityLoading, setEligibilityLoading] = useState(false)
  const router = useRouter()

  const maxRefundDollars = maxRefundableCents > 0 ? (maxRefundableCents / 100).toFixed(2) : "0.00"

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setEligibilityMessage(null)
      setEligibilityLoading(false)
      return
    }

    setEligibilityLoading(true)
    try {
      const response = await fetch(`/api/v1/reservations/${reservationId}`)
      const data = await response.json()
      const message = data?.data?.refund_eligibility?.message
      setEligibilityMessage(typeof message === "string" && message.length > 0 ? message : null)
    } catch {
      setEligibilityMessage(null)
    } finally {
      setEligibilityLoading(false)
    }
  }

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

      const notesWithMethod = [
        notes.trim(),
        refundPaymentMethod ? `Refund method: ${refundPaymentMethod}` : "",
      ]
        .filter(Boolean)
        .join(". ") || undefined

      const body: IssueRefundRequest = {
        amountCents,
        reason,
        notes: notesWithMethod,
      }

      const response = await fetch(`/api/v1/reservations/${reservationId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    } catch (err) {
      console.error("Refund reservation error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

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
            disabled={loading || !refundPaymentMethod || !amountDollars || !reason}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Processing..." : "Issue Refund"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

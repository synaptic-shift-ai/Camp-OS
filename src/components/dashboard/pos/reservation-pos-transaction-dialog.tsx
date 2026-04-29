"use client"

import { useEffect, useMemo, useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { CreditCard, Banknote, FileText, AlertCircle, Loader2 } from "lucide-react"
import { useProperty } from "@/components/property-context"

type PaymentMethodValue = "credit_card" | "cash" | "other"

export type ReservationPosTransactionDialogProps = {
  reservationId: string
  guestId?: string | null
  trigger: React.ReactNode
  mode?: "pos" | "charge_only"
  onSuccess?: () => void
}

const PAYMENT_METHODS: { value: PaymentMethodValue; label: string; icon: React.ElementType }[] = [
  { value: "credit_card", label: "Card", icon: CreditCard },
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "other", label: "Other", icon: FileText },
]

const METHODS_WITH_PROCESSOR = new Set<PaymentMethodValue>(["credit_card"])

const PROCESSOR_OPTIONS = [
  { value: "none", label: "None (Manual)" },
  { value: "stripe", label: "Stripe" },
] as const

export function ReservationPosTransactionDialog({
  reservationId,
  guestId,
  trigger,
  mode = "pos",
  onSuccess,
}: ReservationPosTransactionDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { selectedPropertyId } = useProperty()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [description, setDescription] = useState("")
  const [amountDollars, setAmountDollars] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue | "">("")
  const [processor, setProcessor] = useState<(typeof PROCESSOR_OPTIONS)[number]["value"]>("none")
  const [reference, setReference] = useState("")
  const [error, setError] = useState<string | null>(null)

  const showProcessor = useMemo(
    () => paymentMethod !== "" && METHODS_WITH_PROCESSOR.has(paymentMethod as PaymentMethodValue),
    [paymentMethod],
  )

  const amountCents = Math.round(parseFloat(amountDollars || "0") * 100)

  const isFormValid = description.trim().length > 0 && amountCents >= 1 && paymentMethod !== ""

  useEffect(() => {
    if (!open) return
    setError(null)
    setDescription("")
    setAmountDollars("")
    setPaymentMethod("")
    setProcessor("none")
    setReference("")
  }, [open])

  const apiPaymentMethod = useMemo(() => {
    switch (paymentMethod) {
      case "credit_card":
        return "credit_card"
      case "cash":
        return "cash"
      case "other":
        return "cash"
      default:
        return "cash"
    }
  }, [paymentMethod])

  const handleSubmit = async () => {
    if (!isFormValid) return

    setLoading(true)
    setError(null)

    try {
      const chargeSource = "pos"

      // Step 1: Create the charge
      const chargeRes = await fetch("/api/v1/financial/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          guest_id: guestId ?? null,
          description: description.trim(),
          amount_cents: amountCents,
          source: chargeSource,
        }),
      })

      if (!chargeRes.ok) {
        const body = await chargeRes.json().catch(() => null)
        throw new Error(body?.error?.message ?? body?.error?.details?.message ?? "Failed to create charge")
      }

      if (mode === "pos") {
        // Step 2: Record matching payment (POS)
        const paymentRes = await fetch("/api/v1/financial/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservation_id: reservationId,
            guest_id: guestId ?? null,
            amount_cents: amountCents,
            payment_method: apiPaymentMethod,
            processor: showProcessor && processor !== "none" ? processor : null,
            reference: reference.trim() || null,
            source: "pos",
          }),
        })

        if (!paymentRes.ok) {
          const body = await paymentRes.json().catch(() => null)
          throw new Error(
            body?.error?.message ?? body?.error?.details?.message ?? "Failed to record payment",
          )
        }
      }

      toast({
        title: mode === "charge_only" ? "Charge added" : "POS transaction recorded",
        description:
          mode === "charge_only"
            ? `$${(amountCents / 100).toFixed(2)} charge recorded successfully.`
            : `$${(amountCents / 100).toFixed(2)} charge and payment recorded successfully.`,
        variant: "success",
      })

      setOpen(false)

      onSuccess?.()
      router.refresh()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unexpected error occurred")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-[90vw] max-w-[90vw] overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Record POS Transaction</SheetTitle>
          <SheetDescription>Record a point-of-sale charge and its matching payment.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {selectedPropertyId ? null : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Please select a property.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="pos-description">Description</Label>
            <Input
              id="pos-description"
              type="text"
              placeholder="e.g. Snack shop purchase, Firewood bundle…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pos-amount">Amount</Label>
            <Input
              id="pos-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="$ 0.00"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pos-payment-method">Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(val) => {
                setPaymentMethod(val as PaymentMethodValue)
                setProcessor("none")
              }}
              disabled={loading}
            >
              <SelectTrigger id="pos-payment-method">
                <SelectValue placeholder="Select payment method…" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    <div className="flex items-center gap-2">
                      <method.icon className="h-4 w-4" />
                      <span>{method.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showProcessor ? (
            <div className="space-y-2">
              <Label htmlFor="pos-processor">Processor</Label>
              <Select value={processor} onValueChange={(val) => setProcessor(val as any)} disabled={loading}>
                <SelectTrigger id="pos-processor">
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
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="pos-reference">Reference (Optional)</Label>
            <Input
              id="pos-reference"
              type="text"
              placeholder="e.g. Receipt #, Transaction ID…"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={loading}
              maxLength={255}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={loading || !isFormValid}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? "Recording…" : "Record Transaction"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}


"use client"

import { useEffect, useMemo, useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { useProperty } from "@/components/property-context"

export type ReservationPosTransactionDialogProps = {
  reservationId: string
  guestId?: string | null
  trigger: React.ReactNode
  mode?: "pos" | "charge_only"
  onSuccess?: () => void
}

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
  const [error, setError] = useState<string | null>(null)

  const amountCents = Math.round(parseFloat(amountDollars || "0") * 100)

  const isFormValid = description.trim().length > 0 && amountCents >= 1

  useEffect(() => {
    if (!open) return
    setError(null)
    setDescription("")
    setAmountDollars("")
  }, [open])

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
            payment_method: "cash",
            processor: null,
            reference: null,
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


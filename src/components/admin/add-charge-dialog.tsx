"use client"

import { useCallback, useEffect, useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, DollarSign, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export type AddChargeDialogProps = {
  reservationId: string
  confirmationNumber: string
  guestName: string
  trigger: React.ReactNode
}

export function AddChargeDialog({
  reservationId,
  confirmationNumber,
  guestName,
  trigger,
}: AddChargeDialogProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState("")
  const [amountDollars, setAmountDollars] = useState("")
  const [error, setError] = useState<string | null>(null)

  const amountCents = Math.round(parseFloat(amountDollars || "0") * 100)
  const isFormValid = description.trim().length > 0 && Number.isFinite(amountCents) && amountCents > 0

  const resetState = useCallback(() => {
    setDescription("")
    setAmountDollars("")
    setError(null)
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
    }
  }, [open, resetState])

  const handleSubmit = async () => {
    if (!isFormValid) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/v1/financial/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          description: description.trim(),
          amount_cents: amountCents,
          source: "manual",
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const message =
          body?.error?.message ?? body?.error?.details?.message ?? body?.error?.details ?? body?.message ?? "Failed to create charge"
        throw new Error(message)
      }

      toast({
        title: "Charge added",
        description: `Added $${(amountCents / 100).toFixed(2)} charge for ${confirmationNumber}.`,
        variant: "success",
      })

      setOpen(false)
      resetState()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-[90vw] max-w-[90vw] overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Add Charge</SheetTitle>
          <SheetDescription>
            Add an internal charge for {guestName} ({confirmationNumber}).
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="charge-description">Description</Label>
            <Input
              id="charge-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Late checkout fee, Damage to property…"
              disabled={loading}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="charge-amount">Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="charge-amount"
                type="number"
                min="0"
                step="0.01"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                disabled={loading}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Alert>
            <DollarSign className="h-4 w-4" />
            <AlertDescription className="text-sm">
              This creates a new <span className="font-semibold">charge</span> entry. You can record a matching payment separately.
            </AlertDescription>
          </Alert>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isFormValid}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? "Adding…" : "Add Charge"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}


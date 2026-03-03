"use client"

import { useState } from "react"
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
import { AlertCircle, Banknote, CreditCard, DollarSign, FileText, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface ManualPaymentDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  totalAmountCents: number
  paidAmountCents: number
  trigger: React.ReactNode
}

export function ManualPaymentDialog({
  reservationId,
  confirmationNumber,
  guestName,
  totalAmountCents,
  paidAmountCents,
  trigger,
}: ManualPaymentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const outstandingBalance = Math.max(0, totalAmountCents - paidAmountCents)
  const balanceInDollars = (outstandingBalance / 100).toFixed(2)
  const hasBalance = outstandingBalance > 0

  const handleRecordPayment = async () => {
    if (!hasBalance || !paymentMethod) return

    try {
      setLoading(true)
      setError(null)

      // Placeholder implementation – calls API route when available
      const response = await fetch(`/api/v1/reservations/${reservationId}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amountCents: outstandingBalance,
          paymentMethod: paymentMethod, // "cash" | "check" | "card"
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error?.message || "Failed to record manual payment"
        throw new Error(message)
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      console.error("[ManualPaymentDialog] Error recording payment", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-[480px]">
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
              <span className="text-muted-foreground">{guestName}</span>
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
                      Outstanding Balance: ${balanceInDollars}
                    </span>
                  </AlertDescription>
                </Alert>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-payment-method">Collect Payment</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                >
                  <SelectTrigger id="manual-payment-method">
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        <span>Cash - ${balanceInDollars}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="check">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Check - ${balanceInDollars}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="credit_card">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Card - ${balanceInDollars}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
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
            disabled={loading || !hasBalance || !paymentMethod}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Recording..." : "Record Payment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}


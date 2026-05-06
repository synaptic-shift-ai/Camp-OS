"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CreditCard } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ManualPaymentDialog } from "@/components/admin/manual-payment-dialog"
import type { MoneyCents } from "@/contracts/booking"

export type StoredCardPreview = {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

function cardOnFileSheetDescription(
  guestName: string,
  paymentCard: StoredCardPreview | null | undefined,
  incidentalsCard: StoredCardPreview | null | undefined,
): string {
  const hasBooking = !!paymentCard?.last4
  const hasIncidentals = !!incidentalsCard?.last4
  if (hasBooking && hasIncidentals) {
    return `Stored booking and incidentals cards for ${guestName}.`
  }
  if (hasBooking) {
    return `Stored booking payment card for ${guestName}. No incidentals card on file.`
  }
  if (hasIncidentals) {
    return `No booking payment card on file for ${guestName}. Incidentals card is stored.`
  }
  return `No card on file for ${guestName}.`
}

export type CardOnFileDialogProps = {
  reservationId: string
  confirmationNumber: string
  guestName: string
  totalAmountCents: MoneyCents
  paidAmountCents: MoneyCents
  guestId?: string | null
  onManualPaymentSuccess?: () => void
  paymentCard?: StoredCardPreview | null
  incidentalsCard?: StoredCardPreview | null
  trigger: React.ReactNode
}

export function CardOnFileDialog({
  reservationId,
  confirmationNumber,
  guestName,
  totalAmountCents,
  paidAmountCents,
  guestId,
  onManualPaymentSuccess,
  paymentCard,
  incidentalsCard,
  trigger,
}: CardOnFileDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <span className="inline-flex">{trigger}</span>
      </SheetTrigger>

      <SheetContent className="w-[90vw] max-w-[90vw] overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Card on File</SheetTitle>
          <SheetDescription>
            {cardOnFileSheetDescription(guestName, paymentCard, incidentalsCard)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Booking payment card</div>
            {paymentCard?.last4 ? (
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                <CreditCard className="h-5 w-5" />
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">Card</div>
                  <div className="font-mono text-base text-foreground">
                    **** **** **** {paymentCard.last4}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Exp {paymentCard.exp_month}/{String(paymentCard.exp_year).slice(-2)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                No card payment method is available yet.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Incidentals card-on-file</div>
            {incidentalsCard?.last4 ? (
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                <CreditCard className="h-5 w-5" />
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">Card</div>
                  <div className="font-mono text-base text-foreground">
                    **** **** **** {incidentalsCard.last4}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Exp {incidentalsCard.exp_month}/{String(incidentalsCard.exp_year).slice(-2)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                No incidentals card on file.
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          {/** Separate flows: this sheet previews the stored card, then lets you open payment recording. */}
          <ManualPaymentDialog
            reservationId={reservationId}
            confirmationNumber={confirmationNumber}
            guestName={guestName}
            totalAmountCents={totalAmountCents}
            paidAmountCents={paidAmountCents}
            guestId={guestId ?? null}
            {...(onManualPaymentSuccess ? { onSuccess: onManualPaymentSuccess } : {})}
            defaultPaymentMethod="credit_card"
            defaultProcessor="stripe"
            defaultUseCardOnFile={!!paymentCard}
            trigger={
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="w-full"
                disabled={!paymentCard}
              >
                Record Payment
              </Button>
            }
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}


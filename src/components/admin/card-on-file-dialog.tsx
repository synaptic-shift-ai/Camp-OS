"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { MoneyCents } from "@/contracts/booking"
import { Alert, AlertDescription } from "@/components/ui/alert"

export type StoredCardPreview = {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

type GuestPaymentMethod = {
  id: string
  type: string
  card: StoredCardPreview | null
}

function isSameCard(a: StoredCardPreview | null | undefined, b: StoredCardPreview | null | undefined): boolean {
  if (!a || !b) return false
  return a.last4 === b.last4 && a.exp_month === b.exp_month && a.exp_year === b.exp_year
}

function cardOnFileSheetDescription(
  guestName: string,
  paymentCard: StoredCardPreview | null | undefined,
  incidentalsCard: StoredCardPreview | null | undefined,
): string {
  const hasBooking = !!paymentCard?.last4
  const hasIncidentals = !!incidentalsCard?.last4
  if (hasBooking && hasIncidentals) {
    return `Last-used booking card and incidentals card for ${guestName}. Saved cards are listed below.`
  }
  if (hasBooking) {
    return `Last-used booking card for ${guestName}. Saved cards are listed below.`
  }
  if (hasIncidentals) {
    return `No booking card info available for ${guestName}. Saved cards are listed below.`
  }
  return `No card previews available for ${guestName}. Saved cards are listed below.`
}

export type CardOnFileDialogProps = {
  reservationId: string
  confirmationNumber: string
  guestName: string
  propertyId: string
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
  propertyId,
  totalAmountCents,
  paidAmountCents,
  guestId,
  onManualPaymentSuccess,
  paymentCard,
  incidentalsCard,
  trigger,
}: CardOnFileDialogProps) {
  const [open, setOpen] = useState(false)
  const [loadingCards, setLoadingCards] = useState(false)
  const [cards, setCards] = useState<GuestPaymentMethod[]>([])

  useEffect(() => {
    if (!open) return
    if (!guestId) return
    if (!propertyId) return

    setLoadingCards(true)
    void (async () => {
      try {
        const params = new URLSearchParams({
          property_id: propertyId,
          guest_id: guestId,
        })
        const res = await fetch(`/api/v1/guest/payment-methods?${params.toString()}`, {
          credentials: "include",
        })
        const json = await res.json().catch(() => null)
        const list = (json?.data?.payment_methods ?? json?.payment_methods ?? []) as GuestPaymentMethod[]
        setCards(Array.isArray(list) ? list : [])
      } catch {
        setCards([])
      } finally {
        setLoadingCards(false)
      }
    })()
  }, [open, guestId, propertyId])

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
            <div className="text-xs font-medium text-muted-foreground">Last-used booking card</div>
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

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Saved cards</div>
            {loadingCards ? (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>Loading saved cards…</AlertDescription>
              </Alert>
            ) : cards.length > 0 ? (
              <div className="space-y-2">
                {cards.map((pm) => {
                  const usedForBooking = isSameCard(pm.card, paymentCard)
                  const usedForIncidentals = isSameCard(pm.card, incidentalsCard)

                  return (
                    <div key={pm.id} className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                      <CreditCard className="h-5 w-5" />
                      <div className="min-w-0">
                        <div className="text-sm text-muted-foreground">Card</div>
                        <div className="font-mono text-base text-foreground">
                          {pm.card?.last4 ? `**** **** **** ${pm.card.last4}` : pm.type}
                        </div>
                        {pm.card ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Exp {pm.card.exp_month}/{String(pm.card.exp_year).slice(-2)}
                          </div>
                        ) : null}
                        {usedForBooking || usedForIncidentals ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {usedForBooking ? "Used for booking" : null}
                            {usedForBooking && usedForIncidentals ? " · " : null}
                            {usedForIncidentals ? "Used for incidentals" : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                No saved cards found for this guest.
              </div>
            )}
          </div>
        </div>

      </SheetContent>
    </Sheet>
  )
}


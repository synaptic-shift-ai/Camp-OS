import type Stripe from 'stripe'

export type PaymentCardDisplay = {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

export function extractPaymentIntentIdFromNotes(notes: string | null): string | null {
  if (notes == null || notes.length === 0) return null
  const match =
    notes.match(/Stripe PaymentIntent:\s*(pi_[A-Za-z0-9_]+)/i) ??
    notes.match(/PaymentIntent:\s*(pi_[A-Za-z0-9_]+)/i)
  return match?.[1] ?? null
}

export function resolvePaymentIntentIdForReservation(
  stripePaymentIdFromRow: string | null | undefined,
  reservationNotes: string | null | undefined
): string | null {
  if (
    stripePaymentIdFromRow != null &&
    /^pi_[A-Za-z0-9_]+$/.test(stripePaymentIdFromRow)
  ) {
    return stripePaymentIdFromRow
  }
  return extractPaymentIntentIdFromNotes(reservationNotes ?? null)
}

export function cardDisplayFromStripeCharge(
  charge: Stripe.Charge | string | null | undefined
): PaymentCardDisplay | null {
  if (charge == null || typeof charge === 'string') return null
  const card = charge.payment_method_details?.card
  if (card?.last4 == null || card.last4 === '') return null
  return {
    brand: card.brand ?? 'Card',
    last4: card.last4,
    exp_month: card.exp_month ?? 0,
    exp_year: card.exp_year ?? 0,
  }
}

export function formatPaymentCardBrand(brand: string): string {
  const b = brand.trim().toLowerCase()
  const map: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'Amex',
    'american express': 'Amex',
    discover: 'Discover',
    diners: 'Diners',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  }
  return map[b] ?? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
}

import type Stripe from 'stripe'
import { getTenantStripeClient, getPlatformStripeClient } from '@/lib/stripe/tenant-client'
import {
  cardDisplayFromStripeCharge,
  type PaymentCardDisplay,
} from '@/lib/stripe/payment-intent-card-helpers'

export type { PaymentCardDisplay } from '@/lib/stripe/payment-intent-card-helpers'
export {
  extractPaymentIntentIdFromNotes,
  resolvePaymentIntentIdForReservation,
  cardDisplayFromStripeCharge,
  formatPaymentCardBrand,
} from '@/lib/stripe/payment-intent-card-helpers'

export type PaymentCardResult = {
  card: PaymentCardDisplay | null
  paymentMethodId: string | null
}

export async function fetchPaymentCardDisplay(
  paymentIntentId: string,
  propertyId: string
): Promise<PaymentCardDisplay | null> {
  const result = await fetchPaymentCardResult(paymentIntentId, propertyId)
  return result.card
}

/**
 * Fetches card display info AND the PaymentMethod ID from a PaymentIntent.
 */
export async function fetchPaymentCardResult(
  paymentIntentId: string,
  propertyId: string
): Promise<PaymentCardResult> {
  const tenant = await getTenantStripeClient(propertyId)
  const attempts: Array<{ stripe: Stripe; opts?: Stripe.RequestOptions }> = []
  if (tenant.success) {
    attempts.push({ stripe: tenant.stripe, opts: { stripeAccount: tenant.stripeAccountId } })
  }
  attempts.push({ stripe: getPlatformStripeClient() })

  let card: PaymentCardDisplay | null = null
  let paymentMethodId: string | null = null

  for (const { stripe, opts } of attempts) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ['latest_charge'] },
        opts
      )
      if (!card) {
        card = cardDisplayFromStripeCharge(pi.latest_charge)
      }
      if (!paymentMethodId && pi.payment_method && typeof pi.payment_method === 'string') {
        paymentMethodId = pi.payment_method
      }
      if (card) break
    } catch {
      // Try platform if Connect retrieve failed
    }
  }
  return { card, paymentMethodId }
}

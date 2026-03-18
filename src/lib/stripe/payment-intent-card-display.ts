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

export async function fetchPaymentCardDisplay(
  paymentIntentId: string,
  propertyId: string
): Promise<PaymentCardDisplay | null> {
  const tenant = await getTenantStripeClient(propertyId)
  const attempts: Array<{ stripe: Stripe; opts?: Stripe.RequestOptions }> = []
  if (tenant.success) {
    attempts.push({ stripe: tenant.stripe, opts: { stripeAccount: tenant.stripeAccountId } })
  }
  attempts.push({ stripe: getPlatformStripeClient() })

  for (const { stripe, opts } of attempts) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ['latest_charge'] },
        opts
      )
      const display = cardDisplayFromStripeCharge(pi.latest_charge)
      if (display != null) return display
    } catch {
      // Try platform if Connect retrieve failed
    }
  }
  return null
}

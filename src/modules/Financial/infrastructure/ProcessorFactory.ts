/**
 * Payment Processor Factory
 *
 * Creates the appropriate IPaymentProcessor implementation based on the
 * configured processor type for a property.
 *
 * @module modules/Financial/infrastructure/ProcessorFactory
 */

import type { IPaymentProcessor } from './IPaymentProcessor'
import { StripeProcessor } from './stripe/StripeProcessor'
import { CampOSPaymentsProcessor } from './campost/CampOSPaymentsProcessor'

export type ProcessorType = 'stripe' | 'campost_payments' | 'none'

/**
 * Create a payment processor instance for the given type.
 *
 * @param processorType - The processor type string (from property config)
 * @param stripeAccountId - Required for Stripe: the tenant's connected account ID
 * @returns An IPaymentProcessor instance
 * @throws Error if processor type is 'none' or unknown
 */
export function getProcessor(
  processorType: string,
  stripeAccountId?: string,
): IPaymentProcessor {
  switch (processorType) {
    case 'stripe':
      if (!stripeAccountId) {
        throw new Error('Stripe processor requires a stripeAccountId (connected account ID)')
      }
      return new StripeProcessor(stripeAccountId)

    case 'campost_payments':
      return new CampOSPaymentsProcessor()

    case 'none':
      throw new Error('No payment processor configured. Online payments are disabled for this property.')

    default:
      throw new Error(`Unknown payment processor type: ${processorType}`)
  }
}

/**
 * Stripe Payment Processor
 *
 * Implements IPaymentProcessor using Stripe Connect.
 * Wraps the platform Stripe client with tenant-specific account routing.
 *
 * PaymentIntent/SetupIntent/getPaymentIntent use the destination charge pattern
 * (created on the platform account with `on_behalf_of` + `transfer_data`) so
 * the platform's publishable key works with the returned `client_secret`.
 *
 * Server-side-only methods (refund, customer, payment methods) route through
 * the connected account via `stripeAccount`.
 *
 * @module modules/Financial/infrastructure/stripe/StripeProcessor
 */

import Stripe from 'stripe'
import type {
  IPaymentProcessor,
  PaymentIntentParams,
  PaymentIntentResult,
  RefundParams,
  RefundResult,
  CustomerParams,
  CustomerResult,
  PaymentMethodResult,
  SetupIntentParams,
  SetupIntentResult,
} from '../IPaymentProcessor'

// Reuse the platform Stripe singleton from tenant-client utilities.
// Falls back to a direct instantiation if env var is missing (should not happen in prod).
let _platformStripe: Stripe | null = null
function getPlatformStripe(): Stripe {
  if (_platformStripe) return _platformStripe
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required')
  }
  _platformStripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-09-30.clover',
  })
  return _platformStripe
}

export class StripeProcessor implements IPaymentProcessor {
  private readonly stripeAccount: string

  /**
   * @param stripeAccount - The tenant's connected Stripe account ID
   */
  constructor(stripeAccount: string) {
    if (!stripeAccount) {
      throw new Error('StripeProcessor requires a stripeAccount (connected account ID)')
    }
    this.stripeAccount = stripeAccount
  }

  async createPaymentIntent(params: PaymentIntentParams): Promise<PaymentIntentResult> {
    const stripe = getPlatformStripe()

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: params.amountCents,
      currency: params.currency,
    }

    if (params.customerId) intentParams.customer = params.customerId
    if (params.metadata) intentParams.metadata = params.metadata
    if (params.description) intentParams.description = params.description
    if (params.statementDescriptor) {
      intentParams.statement_descriptor_suffix = params.statementDescriptor.slice(0, 22)
    }
    if (params.receiptEmail) intentParams.receipt_email = params.receiptEmail
    if (params.setupFutureUsage) intentParams.setup_future_usage = params.setupFutureUsage
    if (Array.isArray(params.paymentMethodTypes) && params.paymentMethodTypes.length > 0) {
      intentParams.payment_method_types = params.paymentMethodTypes
    } else if (params.automaticPaymentMethods !== false) {
      intentParams.automatic_payment_methods = { enabled: true }
    }
    // Destination charge pattern: always route through connected account
    // so platform publishable key works with the returned client_secret.
    if (params.onBehalfOf) intentParams.on_behalf_of = params.onBehalfOf
    if (params.transferDestination) {
      intentParams.transfer_data = { destination: params.transferDestination }
    } else {
      intentParams.on_behalf_of = this.stripeAccount
      intentParams.transfer_data = { destination: this.stripeAccount }
    }
    if (params.paymentMethod) intentParams.payment_method = params.paymentMethod
    if (params.confirm) intentParams.confirm = true
    if (params.offSession) intentParams.off_session = true

    // Create on PLATFORM account with destination charge pattern.
    // This allows the platform's publishable key to work with the returned client_secret.
    const pi = await stripe.paymentIntents.create(intentParams)

    return {
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret!,
      status: pi.status,
      amountCents: pi.amount,
      currency: pi.currency,
    }
  }

  async getPaymentIntent(intentId: string): Promise<PaymentIntentResult> {
    const stripe = getPlatformStripe()
    // Retrieve from platform account (destination-charge PIs live there)
    const pi = await stripe.paymentIntents.retrieve(intentId)

    return {
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret ?? '',
      status: pi.status,
      amountCents: pi.amount,
      currency: pi.currency,
    }
  }

  async createRefund(params: RefundParams): Promise<RefundResult> {
    const stripe = getPlatformStripe()

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: params.paymentIntentId,
    }
    if (params.amountCents !== undefined) refundParams.amount = params.amountCents
    if (params.reason) refundParams.reason = params.reason
    if (params.metadata) refundParams.metadata = params.metadata

    const refund = await stripe.refunds.create(refundParams, {
      stripeAccount: this.stripeAccount,
    })

    return {
      refundId: refund.id,
      status: refund.status ?? 'pending',
      amountCents: refund.amount,
    }
  }

  async createCustomer(params: CustomerParams): Promise<CustomerResult> {
    const stripe = getPlatformStripe()

    const customerParams: Stripe.CustomerCreateParams = { email: params.email }
    if (params.name) customerParams.name = params.name
    if (params.phone) customerParams.phone = params.phone
    if (params.metadata) customerParams.metadata = params.metadata

    // Create on PLATFORM account so the resulting customer can be used by
    // platform-created PaymentIntents/SetupIntents (publishable key flow).
    const customer = await stripe.customers.create(customerParams)

    return { customerId: customer.id }
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const stripe = getPlatformStripe()
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    const stripe = getPlatformStripe()
    await stripe.paymentMethods.detach(paymentMethodId)
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]> {
    const stripe = getPlatformStripe()
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' })

    return methods.data.map((pm) => {
      const result: PaymentMethodResult = { id: pm.id, type: pm.type }
      if (pm.card) {
        result.card = {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        }
      }
      return result
    })
  }

  async createSetupIntent(params: SetupIntentParams): Promise<SetupIntentResult> {
    const stripe = getPlatformStripe()

    const siParams: Stripe.SetupIntentCreateParams = {
      customer: params.customerId,
      payment_method_types: ['card'],
      on_behalf_of: this.stripeAccount,
    }
    if (params.metadata) siParams.metadata = params.metadata
    if (params.usage) siParams.usage = params.usage

    // Create on PLATFORM account so platform publishable key works.
    const si = await stripe.setupIntents.create(siParams)

    return {
      setupIntentId: si.id,
      clientSecret: si.client_secret!,
      status: si.status,
    }
  }
}

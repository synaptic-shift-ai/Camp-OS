/**
 * Stripe Adapter Implementation
 *
 * Wraps the Stripe SDK for use in the Financial module.
 */

import Stripe from 'stripe'
import type {
  IStripeAdapter,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  ConfirmPaymentInput,
  RefundInput,
  RefundResult,
  CreateCustomerInput,
  CreateCustomerResult,
  AttachPaymentMethodInput,
  GetPaymentIntentResult,
} from './IStripeAdapter'

export class StripeAdapter implements IStripeAdapter {
  private readonly stripe: Stripe

  constructor(secretKey: string, options?: Stripe.StripeConfig) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-09-30.clover',
      ...options,
    })
  }

  async createPaymentIntent(
    input: CreatePaymentIntentInput
  ): Promise<CreatePaymentIntentResult> {
    // Build params object, only including defined values
    const params: Stripe.PaymentIntentCreateParams = {
      amount: input.amountCents,
      currency: input.currency,
    }

    if (input.customerId !== undefined) {
      params.customer = input.customerId
    }
    if (input.metadata !== undefined) {
      params.metadata = input.metadata
    }
    if (input.description !== undefined) {
      params.description = input.description
    }
    if (input.statementDescriptor !== undefined) {
      params.statement_descriptor_suffix = input.statementDescriptor.slice(0, 22)
    }

    const paymentIntent = await this.stripe.paymentIntents.create(params)

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      status: paymentIntent.status,
    }
  }

  async confirmPayment(
    input: ConfirmPaymentInput
  ): Promise<{ status: string }> {
    const paymentIntent = await this.stripe.paymentIntents.confirm(
      input.paymentIntentId,
      {
        payment_method: input.paymentMethodId,
      }
    )

    return {
      status: paymentIntent.status,
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<GetPaymentIntentResult> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId)

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amountCents: paymentIntent.amount,
      currency: paymentIntent.currency,
      customerId: typeof paymentIntent.customer === 'string'
        ? paymentIntent.customer
        : paymentIntent.customer?.id ?? null,
      metadata: (paymentIntent.metadata ?? {}) as Record<string, string>,
    }
  }

  async createRefund(input: RefundInput): Promise<RefundResult> {
    // Build params object, only including defined values
    const params: Stripe.RefundCreateParams = {
      payment_intent: input.paymentIntentId,
    }

    if (input.amountCents !== undefined) {
      params.amount = input.amountCents
    }
    if (input.reason !== undefined) {
      params.reason = input.reason
    }
    if (input.metadata !== undefined) {
      params.metadata = input.metadata
    }

    const refund = await this.stripe.refunds.create(params)

    return {
      refundId: refund.id,
      status: refund.status ?? 'pending',
      amountCents: refund.amount,
    }
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    // Build params object, only including defined values
    const params: Stripe.CustomerCreateParams = {
      email: input.email,
    }

    if (input.name !== undefined) {
      params.name = input.name
    }
    if (input.metadata !== undefined) {
      params.metadata = input.metadata
    }

    const customer = await this.stripe.customers.create(params)

    return {
      customerId: customer.id,
    }
  }

  async attachPaymentMethod(input: AttachPaymentMethodInput): Promise<void> {
    await this.stripe.paymentMethods.attach(input.paymentMethodId, {
      customer: input.customerId,
    })
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.stripe.paymentMethods.detach(paymentMethodId)
  }

  async listPaymentMethods(customerId: string): Promise<Array<{
    id: string
    type: string
    card?: {
      brand: string
      last4: string
      expMonth: number
      expYear: number
    }
  }>> {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    return paymentMethods.data.map((pm) => {
      const result: {
        id: string
        type: string
        card?: {
          brand: string
          last4: string
          expMonth: number
          expYear: number
        }
      } = {
        id: pm.id,
        type: pm.type,
      }

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
}

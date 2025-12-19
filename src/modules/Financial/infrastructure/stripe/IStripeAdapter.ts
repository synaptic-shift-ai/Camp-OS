/**
 * Stripe Adapter Interface
 *
 * Abstracts Stripe payment operations for testability and flexibility.
 * All amounts are in cents (smallest currency unit).
 */

export interface CreatePaymentIntentInput {
  amountCents: number
  currency: string
  customerId?: string
  metadata?: Record<string, string>
  description?: string
  statementDescriptor?: string
}

export interface CreatePaymentIntentResult {
  paymentIntentId: string
  clientSecret: string
  status: string
}

export interface ConfirmPaymentInput {
  paymentIntentId: string
  paymentMethodId: string
}

export interface RefundInput {
  paymentIntentId: string
  amountCents?: number // Partial refund if specified
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  metadata?: Record<string, string>
}

export interface RefundResult {
  refundId: string
  status: string
  amountCents: number
}

export interface CreateCustomerInput {
  email: string
  name?: string
  metadata?: Record<string, string>
}

export interface CreateCustomerResult {
  customerId: string
}

export interface AttachPaymentMethodInput {
  customerId: string
  paymentMethodId: string
}

export interface GetPaymentIntentResult {
  paymentIntentId: string
  status: string
  amountCents: number
  currency: string
  customerId: string | null
  metadata: Record<string, string>
}

export interface IStripeAdapter {
  /**
   * Create a payment intent for a new payment
   */
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>

  /**
   * Confirm a payment intent with a payment method
   */
  confirmPayment(input: ConfirmPaymentInput): Promise<{ status: string }>

  /**
   * Get payment intent details
   */
  getPaymentIntent(paymentIntentId: string): Promise<GetPaymentIntentResult>

  /**
   * Create a full or partial refund
   */
  createRefund(input: RefundInput): Promise<RefundResult>

  /**
   * Create a Stripe customer
   */
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>

  /**
   * Attach a payment method to a customer
   */
  attachPaymentMethod(input: AttachPaymentMethodInput): Promise<void>

  /**
   * Detach a payment method from a customer
   */
  detachPaymentMethod(paymentMethodId: string): Promise<void>

  /**
   * Get customer's saved payment methods
   */
  listPaymentMethods(customerId: string): Promise<Array<{
    id: string
    type: string
    card?: {
      brand: string
      last4: string
      expMonth: number
      expYear: number
    }
  }>>
}

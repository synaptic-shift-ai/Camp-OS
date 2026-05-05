/**
 * Payment Processor Interface
 *
 * Generic abstraction for payment processors (Stripe, CampOS Payments, etc.).
 * Evolved from IStripeAdapter to be processor-agnostic.
 *
 * All amounts are in cents (smallest currency unit).
 *
 * @module modules/Financial/infrastructure/IPaymentProcessor
 */

// =====================================================
// Shared Types
// =====================================================

export interface PaymentIntentParams {
  amountCents: number
  currency: string
  customerId?: string
  metadata?: Record<string, string>
  description?: string
  statementDescriptor?: string
  /** Receipt email for the payment */
  receiptEmail?: string
  /** Enable automatic payment methods */
  automaticPaymentMethods?: boolean
  /** Connect: charge on behalf of this account */
  onBehalfOf?: string
  /** Connect: transfer data destination */
  transferDestination?: string
}

export interface PaymentIntentResult {
  paymentIntentId: string
  clientSecret: string
  status: string
  amountCents: number
  currency: string
}

export interface RefundParams {
  paymentIntentId: string
  amountCents?: number
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  metadata?: Record<string, string>
}

export interface RefundResult {
  refundId: string
  status: string
  amountCents: number
}

export interface CustomerParams {
  email: string
  name?: string
  phone?: string
  metadata?: Record<string, string>
}

export interface CustomerResult {
  customerId: string
}

export interface PaymentMethodResult {
  id: string
  type: string
  card?: {
    brand: string
    last4: string
    expMonth: number
    expYear: number
  }
}

export interface SetupIntentParams {
  customerId: string
  metadata?: Record<string, string>
}

export interface SetupIntentResult {
  setupIntentId: string
  clientSecret: string
  status: string
}

// =====================================================
// Interface
// =====================================================

export interface IPaymentProcessor {
  /**
   * Create a payment intent for a new payment.
   */
  createPaymentIntent(params: PaymentIntentParams): Promise<PaymentIntentResult>

  /**
   * Retrieve a payment intent by ID.
   */
  getPaymentIntent(intentId: string): Promise<PaymentIntentResult>

  /**
   * Create a full or partial refund.
   */
  createRefund(params: RefundParams): Promise<RefundResult>

  /**
   * Create a customer record.
   */
  createCustomer(params: CustomerParams): Promise<CustomerResult>

  /**
   * Attach a payment method to a customer.
   */
  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>

  /**
   * Detach a payment method from a customer.
   */
  detachPaymentMethod(paymentMethodId: string): Promise<void>

  /**
   * List a customer's saved payment methods.
   */
  listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]>

  /**
   * Create a setup intent for saving a payment method.
   */
  createSetupIntent(params: SetupIntentParams): Promise<SetupIntentResult>
}

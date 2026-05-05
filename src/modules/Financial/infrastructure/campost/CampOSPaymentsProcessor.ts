/**
 * CampOS Payments Processor (Stub)
 *
 * Placeholder implementation of IPaymentProcessor for the future
 * CampOS Payments integration. All methods throw an error indicating
 * the integration is pending partner selection.
 *
 * @module modules/Financial/infrastructure/campost/CampOSPaymentsProcessor
 *
 * @see PRD Epic 1.8 — CampOS Payments Integration
 */

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

const PENDING_MESSAGE =
  'CampOS Payments integration is pending partner selection. See PRD Epic 1.8.'

export class CampOSPaymentsProcessor implements IPaymentProcessor {
  async createPaymentIntent(_params: PaymentIntentParams): Promise<PaymentIntentResult> {
    throw new Error(PENDING_MESSAGE)
  }

  async getPaymentIntent(_intentId: string): Promise<PaymentIntentResult> {
    throw new Error(PENDING_MESSAGE)
  }

  async createRefund(_params: RefundParams): Promise<RefundResult> {
    throw new Error(PENDING_MESSAGE)
  }

  async createCustomer(_params: CustomerParams): Promise<CustomerResult> {
    throw new Error(PENDING_MESSAGE)
  }

  async attachPaymentMethod(_customerId: string, _paymentMethodId: string): Promise<void> {
    throw new Error(PENDING_MESSAGE)
  }

  async detachPaymentMethod(_paymentMethodId: string): Promise<void> {
    throw new Error(PENDING_MESSAGE)
  }

  async listPaymentMethods(_customerId: string): Promise<PaymentMethodResult[]> {
    throw new Error(PENDING_MESSAGE)
  }

  async createSetupIntent(_params: SetupIntentParams): Promise<SetupIntentResult> {
    throw new Error(PENDING_MESSAGE)
  }
}

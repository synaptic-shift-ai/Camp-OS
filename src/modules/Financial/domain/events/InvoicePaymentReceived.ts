/**
 * InvoicePaymentReceived Domain Event
 *
 * Published when a payment is applied to an invoice.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class InvoicePaymentReceived extends DomainEvent {
  constructor(
    public readonly invoiceId: string,
    public readonly transactionId: string,
    public readonly amountCents: number,
    public readonly newBalanceCents: number,
    occurredAt: Date = new Date()
  ) {
    super(occurredAt)
  }
}

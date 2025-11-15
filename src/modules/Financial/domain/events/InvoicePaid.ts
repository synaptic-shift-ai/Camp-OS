/**
 * InvoicePaid Domain Event
 *
 * Published when an invoice is fully paid (balance reaches zero).
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class InvoicePaid extends DomainEvent {
  constructor(
    public readonly invoiceId: string,
    public readonly paidAt: Date,
    occurredAt: Date = new Date()
  ) {
    super(occurredAt)
  }
}

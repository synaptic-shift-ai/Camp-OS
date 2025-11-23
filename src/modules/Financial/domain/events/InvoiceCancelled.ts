/**
 * InvoiceCancelled Domain Event
 *
 * Published when an invoice is cancelled.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class InvoiceCancelled extends DomainEvent {
  constructor(
    public readonly invoiceId: string,
    public readonly invoiceNumber: string,
    public readonly cancelledAt: Date,
    
  ) {
    super()
  }
}

/**
 * InvoiceIssued Domain Event
 *
 * Published when an invoice is issued to the guest.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class InvoiceIssued extends DomainEvent {
  constructor(
    public readonly invoiceId: string,
    public readonly invoiceNumber: string,
    public readonly issuedAt: Date,
    
  ) {
    super()
  }
}

/**
 * InvoiceGenerated Domain Event
 *
 * Published when a new invoice is created (draft status).
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class InvoiceGenerated extends DomainEvent {
  constructor(
    public readonly invoiceId: string,
    public readonly invoiceNumber: string,
    public readonly reservationId: string,
    public readonly totalCents: number,
    public readonly dueDate: Date,
    
  ) {
    super()
  }
}

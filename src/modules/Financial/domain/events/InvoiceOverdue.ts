/**
 * InvoiceOverdue Domain Event
 *
 * Published when an invoice becomes overdue (past due date and not paid).
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class InvoiceOverdue extends DomainEvent {
  constructor(
    public readonly invoiceId: string,
    public readonly invoiceNumber: string,
    public readonly balanceCents: number,
    public readonly daysPastDue: number,
    occurredAt: Date = new Date()
  ) {
    super(occurredAt)
  }
}

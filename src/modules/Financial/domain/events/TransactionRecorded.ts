/**
 * TransactionRecorded Domain Event
 *
 * Published when a new transaction is recorded in the system.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'
import type { TransactionType } from '../value-objects/TransactionType'
import type { PaymentMethod } from '../value-objects/PaymentMethod'

export class TransactionRecorded extends DomainEvent {
  constructor(
    public readonly transactionId: string,
    public readonly propertyId: string,
    public readonly reservationId: string | null,
    public readonly type: TransactionType,
    public readonly amountCents: number,
    public readonly paymentMethod: PaymentMethod,
    occurredAt: Date = new Date()
  ) {
    super(occurredAt)
  }
}

/**
 * TransactionFailed Domain Event
 *
 * Published when a transaction fails to process.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class TransactionFailed extends DomainEvent {
  constructor(
    public readonly transactionId: string,
    public readonly failureReason: string,
    occurredAt: Date = new Date()
  ) {
    super(occurredAt)
  }
}

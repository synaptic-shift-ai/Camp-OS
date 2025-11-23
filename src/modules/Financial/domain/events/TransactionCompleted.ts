/**
 * TransactionCompleted Domain Event
 *
 * Published when a transaction successfully completes processing.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class TransactionCompleted extends DomainEvent {
  constructor(
    public readonly transactionId: string,
    public readonly stripePaymentIntentId: string | null,
    public readonly processedAt: Date,
    
  ) {
    super()
  }
}

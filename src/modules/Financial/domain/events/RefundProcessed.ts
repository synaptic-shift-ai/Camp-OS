/**
 * RefundProcessed Domain Event
 *
 * Published when a refund is successfully processed.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class RefundProcessed extends DomainEvent {
  constructor(
    public readonly transactionId: string,
    public readonly originalTransactionId: string | null,
    public readonly amountCents: number,
    public readonly stripeRefundId: string | null,
  ) {
    super()
  }
}

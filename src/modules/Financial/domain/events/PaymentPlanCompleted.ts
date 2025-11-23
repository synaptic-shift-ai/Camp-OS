/**
 * PaymentPlanCompleted Domain Event
 *
 * Published when all installments in a payment plan are paid.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class PaymentPlanCompleted extends DomainEvent {
  constructor(
    public readonly paymentPlanId: string,
    public readonly completedAt: Date,
    
  ) {
    super()
  }
}

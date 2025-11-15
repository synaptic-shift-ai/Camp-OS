/**
 * PaymentPlanCreated Domain Event
 *
 * Published when a new payment plan is created.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class PaymentPlanCreated extends DomainEvent {
  constructor(
    public readonly paymentPlanId: string,
    public readonly reservationId: string,
    public readonly numberOfInstallments: number,
    public readonly totalAmountCents: number,
    occurredAt: Date = new Date()
  ) {
    super(occurredAt)
  }
}

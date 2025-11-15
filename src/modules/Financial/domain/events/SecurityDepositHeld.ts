/**
 * SecurityDepositHeld Domain Event
 *
 * Published when a security deposit is held.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class SecurityDepositHeld extends DomainEvent {
  constructor(
    public readonly depositId: string,
    public readonly reservationId: string,
    public readonly amountCents: number,
    public readonly stripePaymentIntentId: string | null,
    occurredAt: Date = new Date()
  ) {
    super(occurredAt)
  }
}

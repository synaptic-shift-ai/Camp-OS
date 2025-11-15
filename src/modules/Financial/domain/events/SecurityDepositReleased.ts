/**
 * SecurityDepositReleased Domain Event
 *
 * Published when a security deposit is released back to guest.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class SecurityDepositReleased extends DomainEvent {
  constructor(
    public readonly depositId: string,
    public readonly releasedAmountCents: number,
    public readonly deductionsCents: number,
    occurredAt: Date = new Date()
  ) {
    super(occurredAt)
  }
}

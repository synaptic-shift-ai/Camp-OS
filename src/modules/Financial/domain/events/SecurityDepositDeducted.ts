/**
 * SecurityDepositDeducted Domain Event
 *
 * Published when a deduction is made from a security deposit.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class SecurityDepositDeducted extends DomainEvent {
  constructor(
    public readonly depositId: string,
    public readonly amountCents: number,
    public readonly reason: string,
    public readonly deductedBy: string,
  ) {
    super()
  }
}

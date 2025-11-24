/**
 * ReservationCancelled Domain Event
 *
 * Published when a reservation is cancelled.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class ReservationCancelled extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly confirmationNumber: string,
    public readonly reason: string | null,
    public readonly refundAmountCents: number,
  ) {
    super()
  }
}

/**
 * ReservationConfirmed Domain Event
 *
 * Published when a reservation is confirmed (payment received).
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class ReservationConfirmed extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly confirmationNumber: string,
  ) {
    super()
  }
}

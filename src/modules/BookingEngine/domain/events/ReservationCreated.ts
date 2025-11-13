/**
 * ReservationCreated Domain Event
 *
 * Published when a new reservation is created (pending status).
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class ReservationCreated extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly propertyId: string,
    public readonly siteId: string,
    public readonly guestId: string,
    public readonly confirmationNumber: string,
    public readonly checkInDate: Date,
    public readonly checkOutDate: Date,
    public readonly totalAmountCents: number,
    occurredAt: Date = new Date()
  ) {
    super(occurredAt)
  }
}

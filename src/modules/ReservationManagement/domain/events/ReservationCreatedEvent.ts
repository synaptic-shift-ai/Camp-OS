import { DomainEvent } from '@/shared/domain/DomainEvent'

export class ReservationCreatedEvent extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly propertyId: string,
    public readonly siteId: string,
    public readonly guestId: string,
    public readonly checkIn: Date,
    public readonly checkOut: Date,
    public readonly totalGuests: number,
    public readonly totalAmount: number,
    public readonly confirmationNumber: string
  ) {
    super()
  }
}

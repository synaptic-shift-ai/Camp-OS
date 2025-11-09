import { DomainEvent } from '@/shared/domain/DomainEvent'

export class ReservationConfirmedEvent extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly propertyId: string,
    public readonly siteId: string,
    public readonly confirmationNumber: string,
    public readonly checkIn: Date,
    public readonly checkOut: Date
  ) {
    super()
  }
}

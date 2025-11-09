import { DomainEvent } from '@/shared/domain/DomainEvent'

export class ReservationModifiedEvent extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly propertyId: string,
    public readonly modificationType: 'dates' | 'guest_count' | 'other',
    public readonly oldCheckIn?: Date,
    public readonly oldCheckOut?: Date,
    public readonly newCheckIn?: Date,
    public readonly newCheckOut?: Date
  ) {
    super()
  }
}

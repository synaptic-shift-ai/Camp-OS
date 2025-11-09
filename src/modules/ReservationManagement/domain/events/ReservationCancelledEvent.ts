import { DomainEvent } from '@/shared/domain/DomainEvent'
import { ReservationStatus } from '../Reservation'

export class ReservationCancelledEvent extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly propertyId: string,
    public readonly siteId: string,
    public readonly previousStatus: ReservationStatus,
    public readonly cancelledAt: Date,
    public readonly refundAmount: number
  ) {
    super()
  }
}

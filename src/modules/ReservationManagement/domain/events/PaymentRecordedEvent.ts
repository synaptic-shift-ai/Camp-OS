import { DomainEvent } from '@/shared/domain/DomainEvent'

export class PaymentRecordedEvent extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly propertyId: string,
    public readonly amount: number,
    public readonly paymentMethod: string,
    public readonly balanceDue: number
  ) {
    super()
  }
}

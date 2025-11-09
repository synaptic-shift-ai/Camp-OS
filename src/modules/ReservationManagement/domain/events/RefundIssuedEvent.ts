import { DomainEvent } from '@/shared/domain/DomainEvent'

export class RefundIssuedEvent extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly propertyId: string,
    public readonly amount: number,
    public readonly remainingBalance: number,
    public readonly reason?: string
  ) {
    super()
  }
}

/**
 * PropertyUpdatedEvent
 *
 * Domain event published when property details are updated.
 */
import { DomainEvent } from '@/shared/domain'

export class PropertyUpdatedEvent extends DomainEvent {
  constructor(
    public readonly propertyId: string,
    public readonly companyId: string
  ) {
    super()
  }

  getAggregateId(): string {
    return this.propertyId
  }

  getEventName(): string {
    return 'PropertyUpdated'
  }

  getEventData(): Record<string, any> {
    return {
      propertyId: this.propertyId,
      companyId: this.companyId,
    }
  }
}

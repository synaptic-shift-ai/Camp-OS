/**
 * PropertyCreatedEvent
 *
 * Domain event published when a new property is created.
 */
import { DomainEvent } from '@/shared/domain'

export class PropertyCreatedEvent extends DomainEvent {
  constructor(
    public readonly propertyId: string,
    public readonly companyId: string,
    public readonly name: string,
    public readonly slug: string
  ) {
    super()
  }

  getAggregateId(): string {
    return this.propertyId
  }

  getEventName(): string {
    return 'PropertyCreated'
  }

  getEventData(): Record<string, any> {
    return {
      propertyId: this.propertyId,
      companyId: this.companyId,
      name: this.name,
      slug: this.slug,
    }
  }
}

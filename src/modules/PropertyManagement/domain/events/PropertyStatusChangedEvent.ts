/**
 * PropertyStatusChangedEvent
 *
 * Domain event published when property status changes.
 */
import { DomainEvent } from '@/shared/domain'
import type { PropertyStatus } from '../PropertyStatus'

export class PropertyStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly propertyId: string,
    public readonly companyId: string,
    public readonly oldStatus: PropertyStatus,
    public readonly newStatus: PropertyStatus
  ) {
    super()
  }

  getAggregateId(): string {
    return this.propertyId
  }

  getEventName(): string {
    return 'PropertyStatusChanged'
  }

  getEventData(): Record<string, any> {
    return {
      propertyId: this.propertyId,
      companyId: this.companyId,
      oldStatus: this.oldStatus,
      newStatus: this.newStatus,
    }
  }
}

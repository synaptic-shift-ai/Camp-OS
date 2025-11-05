/**
 * SiteUpdatedEvent
 *
 * Published when site details are updated.
 */
import { DomainEvent } from '@/shared/domain'

export class SiteUpdatedEvent extends DomainEvent {
  constructor(
    public readonly siteId: string,
    public readonly propertyId: string
  ) {
    super()
  }
}

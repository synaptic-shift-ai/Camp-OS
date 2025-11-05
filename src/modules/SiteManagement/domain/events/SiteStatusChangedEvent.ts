/**
 * SiteStatusChangedEvent
 *
 * Published when site status changes (e.g., available -> occupied).
 * Other modules can react to status changes (e.g., update availability calendars).
 */
import { DomainEvent } from '@/shared/domain'
import { SiteStatus } from '../SiteStatus'

export class SiteStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly siteId: string,
    public readonly propertyId: string,
    public readonly oldStatus: SiteStatus,
    public readonly newStatus: SiteStatus
  ) {
    super()
  }
}

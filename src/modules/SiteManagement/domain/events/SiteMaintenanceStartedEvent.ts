/**
 * SiteMaintenanceStartedEvent
 *
 * Published when a site is put under maintenance.
 * More specific than a generic status change - useful for triggering
 * maintenance workflows, notifications to upcoming guests, etc.
 */
import { DomainEvent } from '@/shared/domain'

export class SiteMaintenanceStartedEvent extends DomainEvent {
  constructor(
    public readonly siteId: string,
    public readonly propertyId: string,
    public readonly reason: string | null,
    public readonly estimatedEndDate: Date | null,
    public readonly initiatedBy: string | null
  ) {
    super()
  }
}

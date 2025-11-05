/**
 * SiteCreatedEvent
 *
 * Published when a new site is created.
 * Other modules can subscribe to this to react to new sites.
 */
import { DomainEvent } from '@/shared/domain'
import { SiteType } from '../SiteType'

export class SiteCreatedEvent extends DomainEvent {
  constructor(
    public readonly siteId: string,
    public readonly propertyId: string,
    public readonly siteNumber: string,
    public readonly siteName: string | null,
    public readonly siteType: SiteType
  ) {
    super()
  }
}

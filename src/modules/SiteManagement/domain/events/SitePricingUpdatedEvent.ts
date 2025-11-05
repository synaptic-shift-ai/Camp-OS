/**
 * SitePricingUpdatedEvent
 *
 * Published when site pricing is updated.
 * Useful for analytics, pricing history, and notifications.
 */
import { DomainEvent } from '@/shared/domain'

export class SitePricingUpdatedEvent extends DomainEvent {
  constructor(
    public readonly siteId: string,
    public readonly propertyId: string,
    public readonly oldBasePrice: number, // in cents
    public readonly newBasePrice: number // in cents
  ) {
    super()
  }

  getPriceChange(): number {
    return this.newBasePrice - this.oldBasePrice
  }

  getPriceChangePercentage(): number {
    if (this.oldBasePrice === 0) {
      return 0
    }
    return ((this.newBasePrice - this.oldBasePrice) / this.oldBasePrice) * 100
  }
}

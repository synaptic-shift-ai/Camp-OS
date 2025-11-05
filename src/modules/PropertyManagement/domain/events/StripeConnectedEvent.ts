/**
 * StripeConnectedEvent
 *
 * Domain event published when Stripe Connect is set up for a property.
 */
import { DomainEvent } from '@/shared/domain'

export class StripeConnectedEvent extends DomainEvent {
  constructor(
    public readonly propertyId: string,
    public readonly companyId: string,
    public readonly stripeAccountId: string,
    public readonly connectedAt: Date
  ) {
    super()
  }

  getAggregateId(): string {
    return this.propertyId
  }

  getEventName(): string {
    return 'StripeConnected'
  }

  getEventData(): Record<string, any> {
    return {
      propertyId: this.propertyId,
      companyId: this.companyId,
      stripeAccountId: this.stripeAccountId,
      connectedAt: this.connectedAt.toISOString(),
    }
  }
}

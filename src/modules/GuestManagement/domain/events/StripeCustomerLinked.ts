/**
 * StripeCustomerLinked Domain Event
 *
 * Fired when a Stripe Customer ID is linked to a guest.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface StripeCustomerLinkedProps {
  guestId: string
  propertyId: string
  stripeCustomerId: string
  linkedAt: Date
}

export class StripeCustomerLinked extends DomainEvent {
  public readonly guestId: string
  public readonly propertyId: string
  public readonly stripeCustomerId: string

  constructor(props: StripeCustomerLinkedProps) {
    super()
    this.guestId = props.guestId
    this.propertyId = props.propertyId
    this.stripeCustomerId = props.stripeCustomerId
  }
}

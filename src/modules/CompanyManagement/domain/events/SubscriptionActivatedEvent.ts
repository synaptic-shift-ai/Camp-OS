/**
 * SubscriptionActivatedEvent Domain Event
 *
 * Fired when a subscription is activated (new subscription or reactivation).
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface SubscriptionActivatedEventProps {
  companyId: string
  plan: string
  billingCycle: string
  subscriptionId: string
  stripeCustomerId: string
}

export class SubscriptionActivatedEvent extends DomainEvent {
  public readonly companyId: string
  public readonly plan: string
  public readonly billingCycle: string
  public readonly subscriptionId: string
  public readonly stripeCustomerId: string

  constructor(props: SubscriptionActivatedEventProps) {
    super()
    this.companyId = props.companyId
    this.plan = props.plan
    this.billingCycle = props.billingCycle
    this.subscriptionId = props.subscriptionId
    this.stripeCustomerId = props.stripeCustomerId
  }
}

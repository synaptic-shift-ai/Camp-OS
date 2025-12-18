/**
 * SubscriptionCancelledEvent Domain Event
 *
 * Fired when a subscription is cancelled.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface SubscriptionCancelledEventProps {
  companyId: string
  subscriptionId: string
  reason: string | null
  cancelledAt: Date
}

export class SubscriptionCancelledEvent extends DomainEvent {
  public readonly companyId: string
  public readonly subscriptionId: string
  public readonly reason: string | null
  public readonly cancelledAt: Date

  constructor(props: SubscriptionCancelledEventProps) {
    super()
    this.companyId = props.companyId
    this.subscriptionId = props.subscriptionId
    this.reason = props.reason
    this.cancelledAt = props.cancelledAt
  }
}

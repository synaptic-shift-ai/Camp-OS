/**
 * SubscriptionCanceledEvent Domain Event
 *
 * Fired when a subscription is canceled.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface SubscriptionCanceledEventProps {
  companyId: string
  subscriptionId: string
  reason: string | null
  canceledAt: Date
}

export class SubscriptionCanceledEvent extends DomainEvent {
  public readonly companyId: string
  public readonly subscriptionId: string
  public readonly reason: string | null
  public readonly canceledAt: Date

  constructor(props: SubscriptionCanceledEventProps) {
    super()
    this.companyId = props.companyId
    this.subscriptionId = props.subscriptionId
    this.reason = props.reason
    this.canceledAt = props.canceledAt
  }
}

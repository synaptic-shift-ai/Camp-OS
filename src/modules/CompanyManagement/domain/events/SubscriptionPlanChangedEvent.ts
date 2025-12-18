/**
 * SubscriptionPlanChangedEvent Domain Event
 *
 * Fired when a company changes their subscription plan (upgrade or downgrade).
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface SubscriptionPlanChangedEventProps {
  companyId: string
  previousPlan: string
  newPlan: string
  billingCycle: string
  isUpgrade: boolean
}

export class SubscriptionPlanChangedEvent extends DomainEvent {
  public readonly companyId: string
  public readonly previousPlan: string
  public readonly newPlan: string
  public readonly billingCycle: string
  public readonly isUpgrade: boolean

  constructor(props: SubscriptionPlanChangedEventProps) {
    super()
    this.companyId = props.companyId
    this.previousPlan = props.previousPlan
    this.newPlan = props.newPlan
    this.billingCycle = props.billingCycle
    this.isUpgrade = props.isUpgrade
  }
}

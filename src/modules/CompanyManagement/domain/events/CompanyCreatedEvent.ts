/**
 * CompanyCreatedEvent Domain Event
 *
 * Fired when a new company is registered.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface CompanyCreatedEventProps {
  companyId: string
  name: string
  ownerId: string
  subscriptionPlan: string
}

export class CompanyCreatedEvent extends DomainEvent {
  public readonly companyId: string
  public readonly name: string
  public readonly ownerId: string
  public readonly subscriptionPlan: string

  constructor(props: CompanyCreatedEventProps) {
    super()
    this.companyId = props.companyId
    this.name = props.name
    this.ownerId = props.ownerId
    this.subscriptionPlan = props.subscriptionPlan
  }
}

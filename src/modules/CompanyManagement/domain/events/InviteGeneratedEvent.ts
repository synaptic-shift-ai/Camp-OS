/**
 * InviteGeneratedEvent Domain Event
 *
 * Fired when an invite token is generated for a company.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface InviteGeneratedEventProps {
  companyId: string
  token: string
  expiresAt: Date
}

export class InviteGeneratedEvent extends DomainEvent {
  public readonly companyId: string
  public readonly token: string
  public readonly expiresAt: Date

  constructor(props: InviteGeneratedEventProps) {
    super()
    this.companyId = props.companyId
    this.token = props.token
    this.expiresAt = props.expiresAt
  }
}

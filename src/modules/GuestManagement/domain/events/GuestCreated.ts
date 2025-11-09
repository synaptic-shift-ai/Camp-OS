/**
 * GuestCreated Domain Event
 *
 * Fired when a new guest record is created.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface GuestCreatedProps {
  guestId: string
  propertyId: string
  email: string
  fullName: string
  createdAt: Date
}

export class GuestCreated extends DomainEvent {
  public readonly guestId: string
  public readonly propertyId: string
  public readonly email: string
  public readonly fullName: string

  constructor(props: GuestCreatedProps) {
    super(props.createdAt)
    this.guestId = props.guestId
    this.propertyId = props.propertyId
    this.email = props.email
    this.fullName = props.fullName
  }
}

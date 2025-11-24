/**
 * GuestUpdated Domain Event
 *
 * Fired when guest information is modified.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface GuestUpdatedProps {
  guestId: string
  propertyId: string
  updatedFields: string[]
  updatedAt: Date
}

export class GuestUpdated extends DomainEvent {
  public readonly guestId: string
  public readonly propertyId: string
  public readonly updatedFields: string[]

  constructor(props: GuestUpdatedProps) {
    super()
    this.guestId = props.guestId
    this.propertyId = props.propertyId
    this.updatedFields = props.updatedFields
  }
}

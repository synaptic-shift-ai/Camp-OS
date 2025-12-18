/**
 * StaffRemovedEvent Domain Event
 *
 * Fired when a staff member is removed from a property.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'
import type { StaffRoleType } from '../value-objects/StaffRole'

export interface StaffRemovedEventProps {
  staffId: string
  propertyId: string
  userId: string
  role: StaffRoleType
  removedBy: string
}

export class StaffRemovedEvent extends DomainEvent {
  public readonly staffId: string
  public readonly propertyId: string
  public readonly userId: string
  public readonly role: StaffRoleType
  public readonly removedBy: string

  constructor(props: StaffRemovedEventProps) {
    super()
    this.staffId = props.staffId
    this.propertyId = props.propertyId
    this.userId = props.userId
    this.role = props.role
    this.removedBy = props.removedBy
  }
}

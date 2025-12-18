/**
 * StaffRoleChangedEvent Domain Event
 *
 * Fired when a staff member's role is changed.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'
import type { StaffRoleType } from '../value-objects/StaffRole'

export interface StaffRoleChangedEventProps {
  staffId: string
  propertyId: string
  userId: string
  previousRole: StaffRoleType
  newRole: StaffRoleType
  changedBy: string
}

export class StaffRoleChangedEvent extends DomainEvent {
  public readonly staffId: string
  public readonly propertyId: string
  public readonly userId: string
  public readonly previousRole: StaffRoleType
  public readonly newRole: StaffRoleType
  public readonly changedBy: string

  constructor(props: StaffRoleChangedEventProps) {
    super()
    this.staffId = props.staffId
    this.propertyId = props.propertyId
    this.userId = props.userId
    this.previousRole = props.previousRole
    this.newRole = props.newRole
    this.changedBy = props.changedBy
  }
}

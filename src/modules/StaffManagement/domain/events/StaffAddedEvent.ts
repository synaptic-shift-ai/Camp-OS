/**
 * StaffAddedEvent Domain Event
 *
 * Fired when a staff member is added to a property.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'
import type { StaffRoleType } from '../value-objects/StaffRole'
import type { PermissionKey } from '../value-objects/Permissions'

export interface StaffAddedEventProps {
  staffId: string
  propertyId: string
  userId: string
  role: StaffRoleType
  permissions: PermissionKey[]
}

export class StaffAddedEvent extends DomainEvent {
  public readonly staffId: string
  public readonly propertyId: string
  public readonly userId: string
  public readonly role: StaffRoleType
  public readonly permissions: PermissionKey[]

  constructor(props: StaffAddedEventProps) {
    super()
    this.staffId = props.staffId
    this.propertyId = props.propertyId
    this.userId = props.userId
    this.role = props.role
    this.permissions = props.permissions
  }
}

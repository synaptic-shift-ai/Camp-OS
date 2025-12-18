/**
 * StaffPermissionsUpdatedEvent Domain Event
 *
 * Fired when a staff member's permissions are updated.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'
import type { PermissionKey } from '../value-objects/Permissions'

export interface StaffPermissionsUpdatedEventProps {
  staffId: string
  propertyId: string
  userId: string
  previousPermissions: PermissionKey[]
  newPermissions: PermissionKey[]
  updatedBy: string
}

export class StaffPermissionsUpdatedEvent extends DomainEvent {
  public readonly staffId: string
  public readonly propertyId: string
  public readonly userId: string
  public readonly previousPermissions: PermissionKey[]
  public readonly newPermissions: PermissionKey[]
  public readonly updatedBy: string

  constructor(props: StaffPermissionsUpdatedEventProps) {
    super()
    this.staffId = props.staffId
    this.propertyId = props.propertyId
    this.userId = props.userId
    this.previousPermissions = props.previousPermissions
    this.newPermissions = props.newPermissions
    this.updatedBy = props.updatedBy
  }
}

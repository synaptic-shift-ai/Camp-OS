/**
 * PropertyStaff Data Transfer Object
 *
 * Flattened representation of PropertyStaff aggregate for API responses.
 */

import type { PropertyStaff } from '../../domain/PropertyStaff'
import type { StaffRoleType } from '../../domain/value-objects/StaffRole'
import type { PermissionKey } from '../../domain/value-objects/Permissions'

export interface PropertyStaffDTO {
  id: string
  propertyId: string
  userId: string
  role: StaffRoleType
  roleDisplayName: string
  isAdmin: boolean
  isOwner: boolean
  permissions: PermissionKey[]
  createdAt: string
  updatedAt: string
}

export function propertyStaffToDTO(staff: PropertyStaff): PropertyStaffDTO {
  return {
    id: staff.id,
    propertyId: staff.propertyId,
    userId: staff.userId,
    role: staff.role.value,
    roleDisplayName: staff.role.displayName,
    isAdmin: staff.isAdmin,
    isOwner: staff.isOwner,
    permissions: staff.permissions.toArray(),
    createdAt: staff.createdAt.toISOString(),
    updatedAt: staff.updatedAt.toISOString(),
  }
}

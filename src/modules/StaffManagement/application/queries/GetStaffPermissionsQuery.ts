/**
 * GetStaffPermissionsQuery
 *
 * Retrieves permissions for a staff member.
 * Can look up by staff ID or by property + user ID combination.
 */

import type { IPropertyStaffRepository } from '../../domain/IPropertyStaffRepository'
import type { PermissionKey } from '../../domain/value-objects/Permissions'
import type { StaffRoleType } from '../../domain/value-objects/StaffRole'

export interface GetStaffPermissionsByIdInput {
  staffId: string
}

export interface GetStaffPermissionsByPropertyUserInput {
  propertyId: string
  userId: string
}

export type GetStaffPermissionsInput =
  | GetStaffPermissionsByIdInput
  | GetStaffPermissionsByPropertyUserInput

export interface StaffPermissionsDTO {
  staffId: string
  propertyId: string
  userId: string
  role: StaffRoleType
  permissions: PermissionKey[]
  isAdmin: boolean
  isOwner: boolean
}

export interface GetStaffPermissionsResult {
  success: true
  data: StaffPermissionsDTO
}

export interface GetStaffPermissionsError {
  success: false
  error: {
    code: 'NOT_FOUND'
    message: string
  }
}

export type GetStaffPermissionsOutput = GetStaffPermissionsResult | GetStaffPermissionsError

function isIdInput(input: GetStaffPermissionsInput): input is GetStaffPermissionsByIdInput {
  return 'staffId' in input
}

export class GetStaffPermissionsQueryHandler {
  constructor(private readonly repository: IPropertyStaffRepository) {}

  async execute(input: GetStaffPermissionsInput): Promise<GetStaffPermissionsOutput> {
    let staff

    if (isIdInput(input)) {
      staff = await this.repository.findById(input.staffId)
    } else {
      staff = await this.repository.findByPropertyAndUser(input.propertyId, input.userId)
    }

    if (!staff) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Staff assignment not found',
        },
      }
    }

    return {
      success: true,
      data: {
        staffId: staff.id,
        propertyId: staff.propertyId,
        userId: staff.userId,
        role: staff.role.value,
        permissions: staff.permissions.toArray(),
        isAdmin: staff.isAdmin,
        isOwner: staff.isOwner,
      },
    }
  }
}

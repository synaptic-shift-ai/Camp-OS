/**
 * UpdateStaffPermissionsCommand
 *
 * Updates a staff member's permissions.
 */

import type { PropertyStaff } from '../../domain/PropertyStaff'
import type { IPropertyStaffRepository } from '../../domain/IPropertyStaffRepository'
import type { PermissionKey } from '../../domain/value-objects/Permissions'

export interface UpdateStaffPermissionsInput {
  staffId: string
  permissions: PermissionKey[]
  updatedBy: string
}

export interface UpdateStaffPermissionsResult {
  success: true
  staff: PropertyStaff
}

export interface UpdateStaffPermissionsError {
  success: false
  error: {
    code: 'NOT_FOUND'
    message: string
  }
}

export type UpdateStaffPermissionsOutput = UpdateStaffPermissionsResult | UpdateStaffPermissionsError

export class UpdateStaffPermissionsCommandHandler {
  constructor(
    private readonly repository: IPropertyStaffRepository
  ) {}

  async execute(input: UpdateStaffPermissionsInput): Promise<UpdateStaffPermissionsOutput> {
    // Find staff assignment
    const staff = await this.repository.findById(input.staffId)
    if (!staff) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Staff assignment not found',
        },
      }
    }

    // Update permissions
    staff.updatePermissions(input.permissions, input.updatedBy)

    // Save to repository
    await this.repository.save(staff)

    // Clear domain events
    staff.clearDomainEvents()

    return {
      success: true,
      staff,
    }
  }
}

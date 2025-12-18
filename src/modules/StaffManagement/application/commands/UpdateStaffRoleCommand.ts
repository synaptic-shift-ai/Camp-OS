/**
 * UpdateStaffRoleCommand
 *
 * Changes a staff member's role.
 */

import type { PropertyStaff } from '../../domain/PropertyStaff'
import type { IPropertyStaffRepository } from '../../domain/IPropertyStaffRepository'
import type { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'
import type { StaffRoleType } from '../../domain/value-objects/StaffRole'

export interface UpdateStaffRoleInput {
  staffId: string
  newRole: StaffRoleType
  changedBy: string
  resetPermissions?: boolean
}

export interface UpdateStaffRoleResult {
  success: true
  staff: PropertyStaff
}

export interface UpdateStaffRoleError {
  success: false
  error: {
    code: 'NOT_FOUND' | 'SAME_ROLE' | 'CANNOT_CHANGE_OWNER_ROLE'
    message: string
  }
}

export type UpdateStaffRoleOutput = UpdateStaffRoleResult | UpdateStaffRoleError

export class UpdateStaffRoleCommandHandler {
  constructor(
    private readonly repository: IPropertyStaffRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: UpdateStaffRoleInput): Promise<UpdateStaffRoleOutput> {
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

    // Cannot change owner's role
    if (staff.isOwner) {
      return {
        success: false,
        error: {
          code: 'CANNOT_CHANGE_OWNER_ROLE',
          message: 'Cannot change property owner role',
        },
      }
    }

    // Check if same role
    if (staff.role.value === input.newRole) {
      return {
        success: false,
        error: {
          code: 'SAME_ROLE',
          message: 'Staff member already has this role',
        },
      }
    }

    // Change role
    staff.changeRole(input.newRole, input.changedBy, input.resetPermissions ?? true)

    // Save to repository
    await this.repository.save(staff)

    // Publish domain events
    await this.eventBus.publishAll([...staff.getDomainEvents()])
    staff.clearDomainEvents()

    return {
      success: true,
      staff,
    }
  }
}

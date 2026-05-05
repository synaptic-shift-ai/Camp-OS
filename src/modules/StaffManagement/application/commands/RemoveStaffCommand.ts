/**
 * RemoveStaffCommand
 *
 * Removes a staff member from a property.
 */

import type { IPropertyStaffRepository } from '../../domain/IPropertyStaffRepository'

export interface RemoveStaffInput {
  staffId: string
  removedBy: string
}

export interface RemoveStaffResult {
  success: true
}

export interface RemoveStaffError {
  success: false
  error: {
    code: 'NOT_FOUND' | 'CANNOT_REMOVE_OWNER'
    message: string
  }
}

export type RemoveStaffOutput = RemoveStaffResult | RemoveStaffError

export class RemoveStaffCommandHandler {
  constructor(
    private readonly repository: IPropertyStaffRepository
  ) {}

  async execute(input: RemoveStaffInput): Promise<RemoveStaffOutput> {
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

    // Cannot remove owner
    if (staff.isOwner) {
      return {
        success: false,
        error: {
          code: 'CANNOT_REMOVE_OWNER',
          message: 'Cannot remove property owner from staff',
        },
      }
    }

    // Mark as removed (for event tracking)
    staff.markAsRemoved(input.removedBy)

    // Delete from repository
    await this.repository.delete(input.staffId)

    // Clear domain events
    staff.clearDomainEvents()

    return {
      success: true,
    }
  }
}

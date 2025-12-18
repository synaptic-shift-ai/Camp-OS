/**
 * AddStaffCommand
 *
 * Adds a new staff member to a property.
 */

import { PropertyStaff } from '../../domain/PropertyStaff'
import type { IPropertyStaffRepository } from '../../domain/IPropertyStaffRepository'
import type { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'
import type { StaffRoleType } from '../../domain/value-objects/StaffRole'
import type { PermissionKey } from '../../domain/value-objects/Permissions'

export interface AddStaffInput {
  propertyId: string
  userId: string
  role: StaffRoleType
  customPermissions?: PermissionKey[]
}

export interface AddStaffResult {
  success: true
  staff: PropertyStaff
}

export interface AddStaffError {
  success: false
  error: {
    code: 'ALREADY_EXISTS' | 'VALIDATION_ERROR'
    message: string
  }
}

export type AddStaffOutput = AddStaffResult | AddStaffError

export class AddStaffCommandHandler {
  constructor(
    private readonly repository: IPropertyStaffRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: AddStaffInput): Promise<AddStaffOutput> {
    // Check if user already has assignment at this property
    const existing = await this.repository.existsByPropertyAndUser(input.propertyId, input.userId)
    if (existing) {
      return {
        success: false,
        error: {
          code: 'ALREADY_EXISTS',
          message: 'User already has a staff assignment at this property',
        },
      }
    }

    // Generate staff ID
    const staffId = crypto.randomUUID()

    // Create staff assignment
    const staff = PropertyStaff.create({
      id: staffId,
      propertyId: input.propertyId,
      userId: input.userId,
      role: input.role,
      ...(input.customPermissions && { customPermissions: input.customPermissions }),
    })

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

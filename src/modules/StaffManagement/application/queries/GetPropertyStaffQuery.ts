/**
 * GetPropertyStaffQuery
 *
 * Retrieves a staff member by ID.
 */

import type { IPropertyStaffRepository } from '../../domain/IPropertyStaffRepository'
import { propertyStaffToDTO } from '../DTOs/PropertyStaffDTO'
import type { PropertyStaffDTO } from '../DTOs/PropertyStaffDTO'

export interface GetPropertyStaffInput {
  staffId: string
}

export interface GetPropertyStaffResult {
  success: true
  staff: PropertyStaffDTO
}

export interface GetPropertyStaffError {
  success: false
  error: {
    code: 'NOT_FOUND'
    message: string
  }
}

export type GetPropertyStaffOutput = GetPropertyStaffResult | GetPropertyStaffError

export class GetPropertyStaffQueryHandler {
  constructor(private readonly repository: IPropertyStaffRepository) {}

  async execute(input: GetPropertyStaffInput): Promise<GetPropertyStaffOutput> {
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

    return {
      success: true,
      staff: propertyStaffToDTO(staff),
    }
  }
}

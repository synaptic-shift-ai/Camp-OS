/**
 * ListPropertyStaffQuery
 *
 * Retrieves all staff members for a property.
 */

import type { IPropertyStaffRepository } from '../../domain/IPropertyStaffRepository'
import { propertyStaffToDTO } from '../DTOs/PropertyStaffDTO'
import type { PropertyStaffDTO } from '../DTOs/PropertyStaffDTO'

export interface ListPropertyStaffInput {
  propertyId: string
}

export interface ListPropertyStaffResult {
  success: true
  staff: PropertyStaffDTO[]
  count: number
}

export type ListPropertyStaffOutput = ListPropertyStaffResult

export class ListPropertyStaffQueryHandler {
  constructor(private readonly repository: IPropertyStaffRepository) {}

  async execute(input: ListPropertyStaffInput): Promise<ListPropertyStaffOutput> {
    const staffList = await this.repository.findByProperty(input.propertyId)

    return {
      success: true,
      staff: staffList.map(propertyStaffToDTO),
      count: staffList.length,
    }
  }
}

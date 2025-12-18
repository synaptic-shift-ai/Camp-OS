/**
 * IPropertyStaffRepository Interface
 *
 * Defines the contract for persisting and retrieving PropertyStaff aggregates.
 */

import type { PropertyStaff } from './PropertyStaff'

export interface IPropertyStaffRepository {
  /**
   * Find staff by ID
   *
   * @param id - Staff assignment ID
   * @returns PropertyStaff or null if not found
   */
  findById(id: string): Promise<PropertyStaff | null>

  /**
   * Find staff assignment for a specific user at a property
   *
   * @param propertyId - Property ID
   * @param userId - User ID
   * @returns PropertyStaff or null if not found
   */
  findByPropertyAndUser(propertyId: string, userId: string): Promise<PropertyStaff | null>

  /**
   * Find all staff for a property
   *
   * @param propertyId - Property ID
   * @returns Array of PropertyStaff
   */
  findByProperty(propertyId: string): Promise<PropertyStaff[]>

  /**
   * Find all staff assignments for a user (across all properties)
   *
   * @param userId - User ID
   * @returns Array of PropertyStaff
   */
  findByUser(userId: string): Promise<PropertyStaff[]>

  /**
   * Save staff assignment (insert or update)
   *
   * @param staff - PropertyStaff aggregate to save
   */
  save(staff: PropertyStaff): Promise<void>

  /**
   * Delete staff assignment by ID
   *
   * @param id - Staff assignment ID
   */
  delete(id: string): Promise<void>

  /**
   * Check if a user already has a staff assignment at a property
   *
   * @param propertyId - Property ID
   * @param userId - User ID
   * @param excludeId - Optional staff ID to exclude (for updates)
   * @returns True if user already has assignment
   */
  existsByPropertyAndUser(propertyId: string, userId: string, excludeId?: string): Promise<boolean>

  /**
   * Count staff members at a property
   *
   * @param propertyId - Property ID
   * @returns Number of staff members
   */
  countByProperty(propertyId: string): Promise<number>
}

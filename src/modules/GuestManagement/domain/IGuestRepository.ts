/**
 * Guest Repository Interface
 *
 * Defines the contract for guest persistence operations.
 * Infrastructure layer implements this interface.
 */

import { type Guest } from './Guest'

export interface IGuestRepository {
  /**
   * Save a guest (create or update)
   *
   * @param guest - Guest to save
   */
  save(guest: Guest): Promise<void>

  /**
   * Find guest by ID
   *
   * @param guestId - Guest ID
   * @returns Guest or null if not found
   */
  findById(guestId: string): Promise<Guest | null>

  /**
   * Find guest by email within a property
   *
   * @param propertyId - Property ID (tenant isolation)
   * @param email - Guest email
   * @returns Guest or null if not found
   */
  findByEmail(propertyId: string, email: string): Promise<Guest | null>

  /**
   * Find all guests for a property
   *
   * @param propertyId - Property ID (tenant isolation)
   * @returns Array of guests
   */
  findByPropertyId(propertyId: string): Promise<Guest[]>

  /**
   * Find guest by Stripe Customer ID
   *
   * @param customerId - Stripe Customer ID
   * @returns Guest or null if not found
   */
  findByStripeCustomerId(customerId: string): Promise<Guest | null>

  /**
   * Check if guest exists by email
   *
   * @param propertyId - Property ID (tenant isolation)
   * @param email - Guest email
   * @returns True if exists
   */
  exists(propertyId: string, email: string): Promise<boolean>

  /**
   * Soft-delete a guest by setting deleted_at timestamp.
   * Preserves FK references in reservations and other tables.
   *
   * @param guestId - Guest ID to soft-delete
   */
  softDelete(guestId: string): Promise<void>
}

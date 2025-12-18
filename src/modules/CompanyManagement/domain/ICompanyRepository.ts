/**
 * ICompanyRepository Interface
 *
 * Defines the contract for persisting and retrieving Company aggregates.
 */

import type { Company } from './Company'

export interface ICompanyRepository {
  /**
   * Find company by ID
   *
   * @param id - Company ID
   * @returns Company or null if not found
   */
  findById(id: string): Promise<Company | null>

  /**
   * Find company by owner user ID
   *
   * @param ownerId - Owner's user ID (from auth)
   * @returns Company or null if not found
   */
  findByOwnerId(ownerId: string): Promise<Company | null>

  /**
   * Find company by onboarding token
   *
   * @param token - Onboarding token value
   * @returns Company or null if not found
   */
  findByOnboardingToken(token: string): Promise<Company | null>

  /**
   * Find company by Stripe customer ID
   *
   * @param stripeCustomerId - Stripe customer ID
   * @returns Company or null if not found
   */
  findByStripeCustomerId(stripeCustomerId: string): Promise<Company | null>

  /**
   * Save company (insert or update)
   *
   * @param company - Company aggregate to save
   */
  save(company: Company): Promise<void>

  /**
   * Delete company by ID
   *
   * @param id - Company ID
   */
  delete(id: string): Promise<void>

  /**
   * Check if a company name is already taken
   *
   * @param name - Company name to check
   * @param excludeId - Optional company ID to exclude (for updates)
   * @returns True if name is taken
   */
  isNameTaken(name: string, excludeId?: string): Promise<boolean>
}

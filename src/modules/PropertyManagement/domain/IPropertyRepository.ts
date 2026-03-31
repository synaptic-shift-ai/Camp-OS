/**
 * IPropertyRepository Interface
 *
 * Defines the contract for property persistence.
 * The domain layer depends on this interface, not on the concrete implementation.
 * This enables clean architecture and testability.
 *
 * @example
 * ```typescript
 * // In application layer
 * class CreatePropertyHandler {
 *   constructor(private repository: IPropertyRepository) {}
 *
 *   async execute(command: CreatePropertyCommand): Promise<void> {
 *     const property = Property.create(...)
 *     await this.repository.save(property)
 *   }
 * }
 * ```
 */
import type { Property } from './Property'
import type { PropertyStatus } from './PropertyStatus'

export interface IPropertyRepository {
  /**
   * Find a property by ID
   * Returns null if not found
   */
  findById(id: string): Promise<Property | null>

  /**
   * Find a property by slug
   * Returns null if not found
   */
  findBySlug(slug: string): Promise<Property | null>

  /**
   * Find all properties for a company
   */
  findByCompanyId(companyId: string): Promise<Property[]>

  /**
   * Find properties by company ID with filters
   */
  findByCompanyIdWithFilters(
    companyId: string,
    filters: {
      status?: PropertyStatus | undefined
      onboardingComplete?: boolean | undefined
      limit?: number | undefined
      offset?: number | undefined
    }
  ): Promise<{ properties: Property[]; total: number }>

  /**
   * Find property by owner ID (for user's first property lookup)
   */
  findByOwnerId(ownerId: string): Promise<Property | null>

  /**
   * Save a property (create or update).
   * Optional columnOverrides are merged into the update payload (e.g. cancellation_policy, cancellation_policy_config).
   */
  save(property: Property, columnOverrides?: Record<string, unknown>): Promise<void>

  insertBookingPageSlugAlias(propertyId: string, bookingPageSlug: string): Promise<void>

  /**
   * True if another property already uses this booking_page_slug (for updates).
  */
  bookingPageSlugExistsForOtherProperty(
    bookingPageSlug: string,
    excludePropertyId: string
  ): Promise<boolean>

  /**
   * Delete a property
   */
  delete(id: string): Promise<void>

  /**
   * Check if slug exists
   */
  existsBySlug(slug: string): Promise<boolean>

  /**
   * Check if slug exists for different property (for updates)
   */
  slugExistsForOtherProperty(slug: string, excludePropertyId: string): Promise<boolean>
}

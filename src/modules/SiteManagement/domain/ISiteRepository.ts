/**
 * ISiteRepository Interface
 *
 * Defines the contract for site persistence.
 * The domain layer depends on this interface, not on the concrete implementation.
 * This enables clean architecture and testability.
 *
 * @example
 * ```typescript
 * // In application layer
 * class CreateSiteHandler {
 *   constructor(private repository: ISiteRepository) {}
 *
 *   async execute(command: CreateSiteCommand): Promise<void> {
 *     const site = Site.create(...)
 *     await this.repository.save(site)
 *   }
 * }
 * ```
 */
import { Site } from './Site'
import { SiteStatus } from './SiteStatus'

export interface ISiteRepository {
  /**
   * Find a site by ID
   * Returns null if not found
   */
  findById(id: string): Promise<Site | null>

  /**
   * Find a site by property ID and site number
   * Returns null if not found
   */
  findBySiteNumber(propertyId: string, siteNumber: string): Promise<Site | null>

  /**
   * Find all sites for a property
   */
  findByPropertyId(propertyId: string): Promise<Site[]>

  /**
   * Find sites by property ID with filters
   */
  findByPropertyIdWithFilters(
    propertyId: string,
    filters: {
      status?: SiteStatus
      siteType?: string
      availableOnly?: boolean
      limit?: number
      offset?: number
    }
  ): Promise<{ sites: Site[]; total: number }>

  /**
   * Find available sites for a property
   */
  findAvailableSites(propertyId: string): Promise<Site[]>

  /**
   * Save a site (create or update)
   */
  save(site: Site): Promise<void>

  /**
   * Delete a site
   */
  delete(id: string): Promise<void>

  /**
   * Check if site number exists for property
   */
  existsBySiteNumber(propertyId: string, siteNumber: string): Promise<boolean>
}

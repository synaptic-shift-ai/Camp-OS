/**
 * Availability Service Interface
 *
 * Domain service for checking site availability.
 * This interface defines the contract for availability logic
 * that can be implemented with different strategies.
 *
 * Note: Complex filtering (site type, amenities, reservation type detection)
 * currently lives in lib/booking/availability.ts and will be migrated
 * to this service during API consolidation (Phase 4).
 */

import type { DateRange } from '../value-objects/DateRange'
import type { Reservation } from '../Reservation'

/**
 * Result of checking site availability
 */
export interface SiteAvailabilityResult {
  /** Whether the site is available for the requested dates */
  isAvailable: boolean
  /** Reservations that conflict with the requested dates */
  conflictingReservations: Reservation[]
  /** Reason if not available */
  unavailableReason?: UnavailableReason
}

/**
 * Reasons a site may be unavailable
 */
export type UnavailableReason =
  | 'CONFLICTING_RESERVATION'
  | 'SITE_UNDER_MAINTENANCE'
  | 'SITE_INACTIVE'
  | 'MINIMUM_STAY_NOT_MET'
  | 'MAXIMUM_STAY_EXCEEDED'
  | 'BLOCKED_DATES'

/**
 * Options for availability check
 */
export interface AvailabilityCheckOptions {
  /** Exclude specific reservation IDs (useful for modify operations) */
  excludeReservationIds?: string[]
  /** Whether to check site status (maintenance, inactive) */
  checkSiteStatus?: boolean
  /** Whether to check minimum/maximum stay requirements */
  checkStayRequirements?: boolean
}

/**
 * Multi-site availability result
 */
export interface MultiSiteAvailabilityResult {
  siteId: string
  siteName?: string
  result: SiteAvailabilityResult
}

/**
 * Availability Service Interface
 *
 * Provides methods for checking site availability.
 * Implementations may vary based on caching, performance, or business rules.
 */
export interface IAvailabilityService {
  /**
   * Check if a specific site is available for a date range
   *
   * @param siteId - Site to check
   * @param dateRange - Requested check-in/check-out dates
   * @param options - Additional check options
   * @returns Availability result with conflicting reservations if any
   */
  checkSiteAvailability(
    siteId: string,
    dateRange: DateRange,
    options?: AvailabilityCheckOptions
  ): Promise<SiteAvailabilityResult>

  /**
   * Check availability for multiple sites at once
   *
   * @param siteIds - Sites to check
   * @param dateRange - Requested check-in/check-out dates
   * @param options - Additional check options
   * @returns Availability result for each site
   */
  checkMultipleSitesAvailability(
    siteIds: string[],
    dateRange: DateRange,
    options?: AvailabilityCheckOptions
  ): Promise<MultiSiteAvailabilityResult[]>

  /**
   * Find all available sites for a property within a date range
   *
   * @param propertyId - Property to search
   * @param dateRange - Requested dates
   * @param options - Additional check options
   * @returns List of available site IDs
   */
  findAvailableSites(
    propertyId: string,
    dateRange: DateRange,
    options?: AvailabilityCheckOptions
  ): Promise<string[]>
}

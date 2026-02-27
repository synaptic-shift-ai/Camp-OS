/**
 * Availability Service Implementation
 *
 * Checks site availability by querying existing reservations.
 * Uses the repository pattern to remain infrastructure-agnostic.
 *
 * Note: This is a basic implementation. Complex filtering (site type,
 * amenities, reservation types) will be added during Phase 4 migration
 * from lib/booking/availability.ts.
 */

import type { DateRange } from '../value-objects/DateRange'
import type { IReservationRepository } from '../IReservationRepository'
import type {
  IAvailabilityService,
  SiteAvailabilityResult,
  MultiSiteAvailabilityResult,
  AvailabilityCheckOptions,
} from './IAvailabilityService'

export class AvailabilityService implements IAvailabilityService {
  constructor(private readonly reservationRepository: IReservationRepository) {}

  async checkSiteAvailability(
    siteId: string,
    dateRange: DateRange,
    options?: AvailabilityCheckOptions
  ): Promise<SiteAvailabilityResult> {
    // Find reservations that overlap with the requested date range
    let conflictingReservations = await this.reservationRepository.findBySiteIdAndDateRange(
      siteId,
      dateRange
    )

    // Exclude specific reservations if requested (useful for modify operations)
    if (options?.excludeReservationIds?.length) {
      const excludeSet = new Set(options.excludeReservationIds)
      conflictingReservations = conflictingReservations.filter(
        (r) => !excludeSet.has(r.id)
      )
    }

    if (conflictingReservations.length > 0) {
      return {
        isAvailable: false,
        conflictingReservations,
        unavailableReason: 'CONFLICTING_RESERVATION',
      }
    }

    // TODO: Add site status checking when options.checkSiteStatus is true
    // This requires adding a Site repository dependency
    // if (options?.checkSiteStatus) {
    //   const site = await this.siteRepository.findById(siteId)
    //   if (site?.status === 'maintenance') return { isAvailable: false, ... }
    // }

    // TODO: Add stay requirement checking when options.checkStayRequirements is true
    // This requires site configuration data
    // if (options?.checkStayRequirements) { ... }

    return {
      isAvailable: true,
      conflictingReservations: [],
    }
  }

  async checkMultipleSitesAvailability(
    siteIds: string[],
    dateRange: DateRange,
    options?: AvailabilityCheckOptions
  ): Promise<MultiSiteAvailabilityResult[]> {
    // Check each site in parallel
    const results = await Promise.all(
      siteIds.map(async (siteId) => {
        const result = await this.checkSiteAvailability(siteId, dateRange, options)
        return {
          siteId,
          result,
        }
      })
    )

    return results
  }

  async findAvailableSites(
    propertyId: string,
    dateRange: DateRange,
    options?: AvailabilityCheckOptions
  ): Promise<string[]> {
    // Find all reservations for the property in the date range
    const reservationsInRange = await this.reservationRepository.findByPropertyIdAndDateRange(
      propertyId,
      dateRange
    )

    // Exclude specific reservations if requested
    let filteredReservations = reservationsInRange
    if (options?.excludeReservationIds?.length) {
      const excludeSet = new Set(options.excludeReservationIds)
      filteredReservations = reservationsInRange.filter(
        (r) => !excludeSet.has(r.id)
      )
    }

    // Get unique occupied site IDs
    const _occupiedSiteIds = new Set(filteredReservations.map((r) => r.siteId))

    // TODO: Fetch all site IDs for the property and filter out occupied ones
    // This requires a Site repository or query
    // For now, this method returns an empty array as a placeholder
    // The calling code should use lib/booking/availability.ts until
    // full migration is complete

    // Placeholder - will be fully implemented when Site repository is integrated
    console.warn(
      '[AvailabilityService.findAvailableSites] Not fully implemented. ' +
      'Use lib/booking/availability.ts searchAvailableSites for full functionality.'
    )

    return [] // Will return available site IDs once Site repository is integrated
  }
}

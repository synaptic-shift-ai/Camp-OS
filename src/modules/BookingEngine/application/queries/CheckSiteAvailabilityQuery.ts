/**
 * CheckSiteAvailabilityQuery
 *
 * Query to check if a site is available for a given date range.
 * Returns availability status and any conflicting reservations.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import { DateRange } from '../../domain/value-objects/DateRange'
import type { Reservation } from '../../domain/Reservation'

export type CheckSiteAvailabilityDto = {
  siteId: string
  checkIn: Date
  checkOut: Date
}

export type SiteAvailabilityResult = {
  isAvailable: boolean
  conflictingReservations: Reservation[]
}

export class CheckSiteAvailabilityQueryHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: CheckSiteAvailabilityDto): Promise<SiteAvailabilityResult> {
    // Create date range
    const dateRange = DateRange.create(dto.checkIn, dto.checkOut)

    // Find conflicting reservations
    const conflictingReservations = await this.repository.findBySiteIdAndDateRange(
      dto.siteId,
      dateRange
    )

    return {
      isAvailable: conflictingReservations.length === 0,
      conflictingReservations,
    }
  }
}

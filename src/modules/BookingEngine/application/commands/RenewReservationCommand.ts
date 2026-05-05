/**
 * RenewReservationCommand
 *
 * Command to renew a reservation for an additional period.
 * This creates a linked reservation that continues from the current checkout date.
 * Used for long-term stays (weekly, monthly, seasonal) where guests want to
 * extend their stay for another full period.
 *
 * Unlike ExtendReservation which extends the same reservation,
 * RenewReservation creates a new linked reservation for audit trail purposes.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { IAvailabilityService } from '../../domain/services/IAvailabilityService'
import { Reservation, ReservationStatus } from '../../domain/Reservation'
import { DateRange } from '../../domain/value-objects/DateRange'
import { MoneyAmount } from '../../domain/value-objects/MoneyAmount'
import { ConfirmationNumber } from '../../domain/value-objects/ConfirmationNumber'

export type RenewalPeriod = 'weekly' | 'monthly' | 'custom'

export type RenewReservationDto = {
  originalReservationId: string
  renewalPeriod: RenewalPeriod
  customNights?: number // Required if renewalPeriod is 'custom'
  totalAmountCents: number
  specialRequests?: string | null
}

export type RenewReservationResult = {
  success: true
  originalReservation: Reservation
  renewalReservation: Reservation
  renewalNights: number
} | {
  success: false
  error: 'NOT_FOUND' | 'INVALID_STATUS' | 'NOT_AVAILABLE' | 'INVALID_PERIOD'
  message: string
}

export class RenewReservationCommandHandler {
  constructor(
    private readonly repository: IReservationRepository,
    private readonly availabilityService: IAvailabilityService
  ) {}

  async execute(dto: RenewReservationDto): Promise<RenewReservationResult> {
    // Find original reservation
    const originalReservation = await this.repository.findById(dto.originalReservationId)

    if (!originalReservation) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: `Reservation with ID '${dto.originalReservationId}' not found`,
      }
    }

    // Only confirmed or checked-in reservations can be renewed
    const validStatuses = [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN]
    if (!validStatuses.includes(originalReservation.status)) {
      return {
        success: false,
        error: 'INVALID_STATUS',
        message: `Reservation cannot be renewed in status '${originalReservation.status}'`,
      }
    }

    // Calculate renewal period nights
    const renewalNights = this.calculateRenewalNights(dto.renewalPeriod, dto.customNights)
    if (renewalNights === null) {
      return {
        success: false,
        error: 'INVALID_PERIOD',
        message: 'Custom nights required for custom renewal period',
      }
    }

    // Calculate renewal dates (starts at original checkout)
    const renewalCheckIn = originalReservation.checkOutDate
    const renewalCheckOut = new Date(renewalCheckIn)
    renewalCheckOut.setDate(renewalCheckOut.getDate() + renewalNights)

    // Validate renewal date range
    let renewalDateRange: DateRange
    try {
      renewalDateRange = DateRange.create(renewalCheckIn, renewalCheckOut)
    } catch {
      return {
        success: false,
        error: 'INVALID_PERIOD',
        message: 'Invalid renewal dates calculated',
      }
    }

    // Check availability for renewal period
    const availabilityResult = await this.availabilityService.checkSiteAvailability(
      originalReservation.siteId,
      renewalDateRange
    )

    if (!availabilityResult.isAvailable) {
      return {
        success: false,
        error: 'NOT_AVAILABLE',
        message: 'Site is not available for the renewal period',
      }
    }

    // Create new linked reservation
    const renewalReservation = Reservation.create(
      crypto.randomUUID(),
      originalReservation.propertyId,
      originalReservation.siteId,
      originalReservation.guestId,
      ConfirmationNumber.generate(),
      renewalDateRange,
      originalReservation.occupancy,
      MoneyAmount.create(dto.totalAmountCents),
      dto.specialRequests,
      'renewal' // Source indicates this is a renewal
    )

    // Save the renewal reservation
    await this.repository.save(renewalReservation)

    // Clear domain events
    renewalReservation.clearDomainEvents()

    return {
      success: true,
      originalReservation,
      renewalReservation,
      renewalNights,
    }
  }

  private calculateRenewalNights(
    period: RenewalPeriod,
    customNights?: number
  ): number | null {
    switch (period) {
      case 'weekly':
        return 7
      case 'monthly':
        return 30
      case 'custom':
        return customNights && customNights > 0 ? customNights : null
      default:
        return null
    }
  }
}

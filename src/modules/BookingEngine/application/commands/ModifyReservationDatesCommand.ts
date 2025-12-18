/**
 * ModifyReservationDatesCommand
 *
 * Command to modify the check-in and check-out dates of a reservation.
 * Validates availability and recalculates pricing.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { IAvailabilityService } from '../../domain/services/IAvailabilityService'
import type { Reservation } from '../../domain/Reservation'
import { DateRange } from '../../domain/value-objects/DateRange'
import { MoneyAmount } from '../../domain/value-objects/MoneyAmount'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type ModifyReservationDatesDto = {
  reservationId: string
  newCheckIn: Date
  newCheckOut: Date
  newTotalAmountCents: number
}

export type ModifyReservationDatesResult = {
  success: true
  reservation: Reservation
} | {
  success: false
  error: 'NOT_FOUND' | 'NOT_MODIFIABLE' | 'NOT_AVAILABLE' | 'INVALID_DATES'
  message: string
}

export class ModifyReservationDatesCommandHandler {
  constructor(
    private readonly repository: IReservationRepository,
    private readonly availabilityService: IAvailabilityService
  ) {}

  async execute(dto: ModifyReservationDatesDto): Promise<ModifyReservationDatesResult> {
    // Find reservation
    const reservation = await this.repository.findById(dto.reservationId)

    if (!reservation) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: `Reservation with ID '${dto.reservationId}' not found`,
      }
    }

    // Check if reservation can be modified
    if (!reservation.canBeModified()) {
      return {
        success: false,
        error: 'NOT_MODIFIABLE',
        message: `Reservation cannot be modified in status '${reservation.status}'`,
      }
    }

    // Validate date range
    let newDateRange: DateRange
    try {
      newDateRange = DateRange.create(dto.newCheckIn, dto.newCheckOut)
    } catch {
      return {
        success: false,
        error: 'INVALID_DATES',
        message: 'Invalid date range provided',
      }
    }

    // Check availability for new dates (excluding current reservation)
    const availabilityResult = await this.availabilityService.checkSiteAvailability(
      reservation.siteId,
      newDateRange,
      { excludeReservationIds: [reservation.id] }
    )

    if (!availabilityResult.isAvailable) {
      return {
        success: false,
        error: 'NOT_AVAILABLE',
        message: 'Site is not available for the requested dates',
      }
    }

    // Modify the reservation
    const newTotalAmount = MoneyAmount.create(dto.newTotalAmountCents)
    reservation.modifyDates(newDateRange, newTotalAmount)

    // Save updated reservation
    await this.repository.save(reservation)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll([...reservation.getDomainEvents()])
    reservation.clearDomainEvents()

    return {
      success: true,
      reservation,
    }
  }
}

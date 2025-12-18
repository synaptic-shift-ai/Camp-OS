/**
 * ExtendReservationCommand
 *
 * Command to extend a reservation's checkout date.
 * This is a specialized date modification that only extends (not shortens)
 * the stay and validates availability for the extended period.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { IAvailabilityService } from '../../domain/services/IAvailabilityService'
import type { Reservation } from '../../domain/Reservation'
import { DateRange } from '../../domain/value-objects/DateRange'
import { MoneyAmount } from '../../domain/value-objects/MoneyAmount'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type ExtendReservationDto = {
  reservationId: string
  newCheckOutDate: Date
  additionalAmountCents: number
}

export type ExtendReservationResult = {
  success: true
  reservation: Reservation
  additionalNights: number
} | {
  success: false
  error: 'NOT_FOUND' | 'NOT_MODIFIABLE' | 'NOT_AVAILABLE' | 'INVALID_EXTENSION' | 'ALREADY_PAST'
  message: string
}

export class ExtendReservationCommandHandler {
  constructor(
    private readonly repository: IReservationRepository,
    private readonly availabilityService: IAvailabilityService
  ) {}

  async execute(dto: ExtendReservationDto): Promise<ExtendReservationResult> {
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
        message: `Reservation cannot be extended in status '${reservation.status}'`,
      }
    }

    // Validate new checkout is after current checkout
    const currentCheckOut = reservation.checkOutDate
    if (dto.newCheckOutDate <= currentCheckOut) {
      return {
        success: false,
        error: 'INVALID_EXTENSION',
        message: 'New checkout date must be after current checkout date',
      }
    }

    // Calculate additional nights
    const additionalNights = Math.ceil(
      (dto.newCheckOutDate.getTime() - currentCheckOut.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Check availability for the extension period only
    let extensionDateRange: DateRange
    try {
      extensionDateRange = DateRange.create(currentCheckOut, dto.newCheckOutDate)
    } catch {
      return {
        success: false,
        error: 'INVALID_EXTENSION',
        message: 'Invalid extension dates provided',
      }
    }

    // Check if extension period is available (excluding current reservation)
    const availabilityResult = await this.availabilityService.checkSiteAvailability(
      reservation.siteId,
      extensionDateRange,
      { excludeReservationIds: [reservation.id] }
    )

    if (!availabilityResult.isAvailable) {
      return {
        success: false,
        error: 'NOT_AVAILABLE',
        message: 'Site is not available for the requested extension period',
      }
    }

    // Create new date range with extended checkout
    const newDateRange = DateRange.create(reservation.checkInDate, dto.newCheckOutDate)

    // Calculate new total
    const newTotalAmount = reservation.totalAmount.add(
      MoneyAmount.create(dto.additionalAmountCents)
    )

    // Modify the reservation
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
      additionalNights,
    }
  }
}

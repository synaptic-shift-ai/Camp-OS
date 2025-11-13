/**
 * CreateReservationCommand
 *
 * Command to create a new reservation.
 * Validates site availability and business rules before creating the reservation.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import { Reservation } from '../../domain/Reservation'
import { DateRange } from '../../domain/value-objects/DateRange'
import { MoneyAmount } from '../../domain/value-objects/MoneyAmount'
import { ConfirmationNumber } from '../../domain/value-objects/ConfirmationNumber'
import { OccupancyInfo } from '../../domain/value-objects/OccupancyInfo'
import { getEventBus } from '@/shared/infrastructure/eventBus'
import { randomUUID } from 'crypto'

export type CreateReservationDto = {
  propertyId: string
  siteId: string
  guestId: string
  checkIn: Date
  checkOut: Date
  occupancy: {
    numAdults: number
    numChildren?: number
    numPets?: number
    numVehicles?: number
  }
  totalAmountCents: number
  specialRequests?: string | null
  source?: string
}

export class CreateReservationCommandHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: CreateReservationDto): Promise<Reservation> {
    // Create value objects
    const dateRange = DateRange.create(dto.checkIn, dto.checkOut)
    const occupancy = OccupancyInfo.create(
      dto.occupancy.numAdults,
      dto.occupancy.numChildren,
      dto.occupancy.numPets,
      dto.occupancy.numVehicles
    )
    const totalAmount = MoneyAmount.create(dto.totalAmountCents)
    const confirmationNumber = ConfirmationNumber.generate()

    // Check site availability for date range
    const siteHasConflict = await this.repository.existsForSiteInDateRange(dto.siteId, dateRange)

    if (siteHasConflict) {
      throw new Error(
        `Site is not available for the selected dates (${dateRange.checkIn.toISOString().split('T')[0]} to ${dateRange.checkOut.toISOString().split('T')[0]})`
      )
    }

    // Create reservation aggregate
    const reservation = Reservation.create(
      randomUUID(),
      dto.propertyId,
      dto.siteId,
      dto.guestId,
      confirmationNumber,
      dateRange,
      occupancy,
      totalAmount,
      dto.specialRequests,
      dto.source
    )

    // Save to database
    await this.repository.save(reservation)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll(reservation.getDomainEvents())
    reservation.clearDomainEvents()

    return reservation
  }
}

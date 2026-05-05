/**
 * ModifyReservationGuestsCommand
 *
 * Command to modify the guest count of a reservation.
 * Recalculates pricing based on new occupancy.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation } from '../../domain/Reservation'
import { OccupancyInfo } from '../../domain/value-objects/OccupancyInfo'
import { MoneyAmount } from '../../domain/value-objects/MoneyAmount'

export type ModifyReservationGuestsDto = {
  reservationId: string
  numAdults: number
  numChildren: number
  numPets: number
  numVehicles: number
  newTotalAmountCents: number
}

export type ModifyReservationGuestsResult = {
  success: true
  reservation: Reservation
} | {
  success: false
  error: 'NOT_FOUND' | 'NOT_MODIFIABLE' | 'INVALID_OCCUPANCY'
  message: string
}

export class ModifyReservationGuestsCommandHandler {
  constructor(
    private readonly repository: IReservationRepository
  ) {}

  async execute(dto: ModifyReservationGuestsDto): Promise<ModifyReservationGuestsResult> {
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

    // Validate and create new occupancy
    let newOccupancy: OccupancyInfo
    try {
      newOccupancy = OccupancyInfo.create(
        dto.numAdults,
        dto.numChildren,
        dto.numPets,
        dto.numVehicles
      )
    } catch {
      return {
        success: false,
        error: 'INVALID_OCCUPANCY',
        message: 'Invalid occupancy information provided',
      }
    }

    // Modify the reservation
    const newTotalAmount = MoneyAmount.create(dto.newTotalAmountCents)
    reservation.modifyGuestCount(newOccupancy, newTotalAmount)

    // Save updated reservation
    await this.repository.save(reservation)

    // Clear domain events
    reservation.clearDomainEvents()

    return {
      success: true,
      reservation,
    }
  }
}

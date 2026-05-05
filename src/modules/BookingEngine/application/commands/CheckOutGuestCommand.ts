/**
 * CheckOutGuestCommand
 *
 * Command to check out a guest from their reservation.
 * Validates reservation is checked in and records checkout details.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation } from '../../domain/Reservation'

export type CheckOutGuestDto = {
  reservationId: string
  staffUserId: string
  hasDamages?: boolean | undefined
  notes?: string | null | undefined
}

export class CheckOutGuestCommandHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: CheckOutGuestDto): Promise<Reservation> {
    // Find reservation
    const reservation = await this.repository.findById(dto.reservationId)

    if (!reservation) {
      throw new Error(`Reservation with ID '${dto.reservationId}' not found`)
    }

    // Check out guest (will throw if not checked in)
    reservation.checkOut(dto.staffUserId, dto.hasDamages || false, dto.notes || null)

    // Save updated reservation
    await this.repository.save(reservation)

    // Clear domain events
    reservation.clearDomainEvents()

    return reservation
  }
}

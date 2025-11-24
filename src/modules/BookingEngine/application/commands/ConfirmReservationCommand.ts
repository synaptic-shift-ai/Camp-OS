/**
 * ConfirmReservationCommand
 *
 * Command to confirm a reservation after payment is received.
 * Validates that reservation is fully paid before confirmation.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation } from '../../domain/Reservation'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type ConfirmReservationDto = {
  reservationId: string
}

export class ConfirmReservationCommandHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: ConfirmReservationDto): Promise<Reservation> {
    // Find reservation
    const reservation = await this.repository.findById(dto.reservationId)

    if (!reservation) {
      throw new Error(`Reservation with ID '${dto.reservationId}' not found`)
    }

    // Confirm reservation (will throw if not fully paid or not in pending status)
    reservation.confirm()

    // Save updated reservation
    await this.repository.save(reservation)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll([...reservation.getDomainEvents()])
    reservation.clearDomainEvents()

    return reservation
  }
}

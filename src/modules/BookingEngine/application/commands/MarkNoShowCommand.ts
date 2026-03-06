/**
 * MarkNoShowCommand
 *
 * Command to mark a reservation as no-show when a guest
 * fails to arrive for their check-in.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation } from '../../domain/Reservation'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type MarkNoShowDto = {
  reservationId: string
  staffUserId: string
}

export type MarkNoShowResult = {
  success: true
  reservation: Reservation
} | {
  success: false
  error: 'NOT_FOUND' | 'INVALID_STATUS'
  message: string
}

export class MarkNoShowCommandHandler {
  constructor(
    private readonly repository: IReservationRepository
  ) {}

  async execute(dto: MarkNoShowDto): Promise<MarkNoShowResult> {
    // Find reservation
    const reservation = await this.repository.findById(dto.reservationId)

    if (!reservation) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: `Reservation with ID '${dto.reservationId}' not found`,
      }
    }

    // Attempt to mark as no-show (will throw if not confirmed or pending)
    try {
      reservation.markNoShow(dto.staffUserId)
    } catch {
      return {
        success: false,
        error: 'INVALID_STATUS',
        message: 'Can only mark confirmed or pending reservations as no-show',
      }
    }

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

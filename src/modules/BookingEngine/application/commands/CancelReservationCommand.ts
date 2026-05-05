/**
 * CancelReservationCommand
 *
 * Command to cancel a reservation with optional refund.
 * Validates cancellation policy and calculates refund amount.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation } from '../../domain/Reservation'
import { MoneyAmount } from '../../domain/value-objects/MoneyAmount'

export type CancelReservationDto = {
  reservationId: string
  reason?: string | null | undefined
  refundAmountCents: number
  notes?: string | null | undefined
}

export class CancelReservationCommandHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: CancelReservationDto): Promise<Reservation> {
    // Find reservation
    const reservation = await this.repository.findById(dto.reservationId)

    if (!reservation) {
      throw new Error(`Reservation with ID '${dto.reservationId}' not found`)
    }

    // Create refund amount
    const refundAmount = MoneyAmount.create(dto.refundAmountCents)

    // Cancel reservation (will throw if not cancellable or refund invalid)
    reservation.cancel(dto.reason || null, refundAmount)
    if (dto.notes != null) {
      reservation.updateNotes(dto.notes)
    }

    // Save updated reservation
    await this.repository.save(reservation)

    // Clear domain events
    reservation.clearDomainEvents()

    return reservation
  }
}

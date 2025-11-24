/**
 * CheckInGuestCommand
 *
 * Command to check in a guest for their reservation.
 * Validates reservation is confirmed and check-in date requirements.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation } from '../../domain/Reservation'
import { MoneyAmount } from '../../domain/value-objects/MoneyAmount'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type CheckInGuestDto = {
  reservationId: string
  staffUserId: string
  balancePaidCents?: number | undefined
  notes?: string | null | undefined
}

export class CheckInGuestCommandHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: CheckInGuestDto): Promise<Reservation> {
    // Find reservation
    const reservation = await this.repository.findById(dto.reservationId)

    if (!reservation) {
      throw new Error(`Reservation with ID '${dto.reservationId}' not found`)
    }

    // Create balance payment if provided
    const balancePaid = dto.balancePaidCents
      ? MoneyAmount.create(dto.balancePaidCents)
      : MoneyAmount.zero()

    // Check in guest (will throw if not confirmed or check-in date invalid)
    reservation.checkIn(dto.staffUserId, balancePaid, dto.notes || null)

    // Save updated reservation
    await this.repository.save(reservation)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll([...reservation.getDomainEvents()])
    reservation.clearDomainEvents()

    return reservation
  }
}

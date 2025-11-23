/**
 * RecordPaymentCommand
 *
 * Command to record a payment received for a reservation.
 * Updates payment status and publishes payment events.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation } from '../../domain/Reservation'
import { MoneyAmount } from '../../domain/value-objects/MoneyAmount'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type RecordPaymentDto = {
  reservationId: string
  amountCents: number
  paymentMethod: string
  stripePaymentIntentId?: string | null | undefined
}

export class RecordPaymentCommandHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: RecordPaymentDto): Promise<Reservation> {
    // Find reservation
    const reservation = await this.repository.findById(dto.reservationId)

    if (!reservation) {
      throw new Error(`Reservation with ID '${dto.reservationId}' not found`)
    }

    // Create money amount
    const amount = MoneyAmount.create(dto.amountCents)

    // Record payment on aggregate
    reservation.receivePayment(amount, dto.paymentMethod, dto.stripePaymentIntentId || null)

    // Save updated reservation
    await this.repository.save(reservation)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll(reservation.getDomainEvents())
    reservation.clearDomainEvents()

    return reservation
  }
}

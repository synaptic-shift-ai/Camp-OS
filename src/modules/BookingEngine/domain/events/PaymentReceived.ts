/**
 * PaymentReceived Domain Event
 *
 * Published when a payment is received for a reservation.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class PaymentReceived extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly confirmationNumber: string,
    public readonly amountCents: number,
    public readonly paymentMethod: string,
    public readonly stripePaymentIntentId: string | null,
  ) {
    super()
  }
}

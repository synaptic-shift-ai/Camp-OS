/**
 * RefundInitiated Domain Event
 *
 * Published when a refund is initiated for a reservation.
 * This tracks the refund request before it's processed by the payment provider.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export type RefundReason =
  | 'cancellation'
  | 'partial_cancellation'
  | 'service_issue'
  | 'overbooking'
  | 'weather'
  | 'other'

export class RefundInitiated extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly confirmationNumber: string,
    public readonly refundAmountCents: number,
    public readonly reason: RefundReason,
    public readonly notes: string | null,
    public readonly initiatedBy: string, // Staff user ID
  ) {
    super()
  }
}

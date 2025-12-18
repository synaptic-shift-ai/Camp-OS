/**
 * NoShowMarked Domain Event
 *
 * Published when a guest fails to arrive and the reservation is marked as no-show.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class NoShowMarked extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly confirmationNumber: string,
    public readonly markedBy: string,
    public readonly scheduledCheckInDate: Date,
  ) {
    super()
  }
}

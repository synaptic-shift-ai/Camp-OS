/**
 * GuestCheckedIn Domain Event
 *
 * Published when a guest checks in to their reservation.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class GuestCheckedIn extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly confirmationNumber: string,
    public readonly checkedInBy: string, // Staff user ID
    public readonly balancePaidCents: number, // Additional payment at check-in
  ) {
    super()
  }
}

/**
 * GuestCheckedOut Domain Event
 *
 * Published when a guest checks out from their reservation.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class GuestCheckedOut extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly confirmationNumber: string,
    public readonly checkedOutBy: string, // Staff user ID
    public readonly hasDamages: boolean,
  ) {
    super()
  }
}

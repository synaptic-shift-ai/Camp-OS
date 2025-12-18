/**
 * ReservationModified Domain Event
 *
 * Published when a reservation's dates or guest count is modified.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export type ReservationModificationType = 'dates' | 'guests' | 'site'

export interface DateModification {
  previousCheckIn: Date
  previousCheckOut: Date
  newCheckIn: Date
  newCheckOut: Date
}

export interface GuestModification {
  previousAdults: number
  previousChildren: number
  newAdults: number
  newChildren: number
}

export class ReservationModified extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly confirmationNumber: string,
    public readonly modificationType: ReservationModificationType,
    public readonly dateModification: DateModification | null,
    public readonly guestModification: GuestModification | null,
    public readonly newTotalAmountCents: number,
    public readonly previousTotalAmountCents: number,
  ) {
    super()
  }
}

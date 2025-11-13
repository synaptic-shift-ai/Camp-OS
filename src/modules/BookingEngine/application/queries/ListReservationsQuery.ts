/**
 * ListReservationsQuery
 *
 * Query to retrieve reservations with filtering and pagination.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation, ReservationStatus } from '../../domain/Reservation'

export type ListReservationsDto = {
  propertyId: string
  status?: ReservationStatus
  guestId?: string
  siteId?: string
  checkInFrom?: Date
  checkInTo?: Date
  limit?: number
  offset?: number
}

export type ListReservationsResult = {
  reservations: Reservation[]
  total: number
}

export class ListReservationsQueryHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: ListReservationsDto): Promise<ListReservationsResult> {
    return await this.repository.findByPropertyIdWithFilters(dto.propertyId, {
      status: dto.status,
      guestId: dto.guestId,
      siteId: dto.siteId,
      checkInFrom: dto.checkInFrom,
      checkInTo: dto.checkInTo,
      limit: dto.limit || 50,
      offset: dto.offset || 0,
    })
  }
}

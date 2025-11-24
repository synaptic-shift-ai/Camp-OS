/**
 * ListReservationsQuery
 *
 * Query to retrieve reservations with filtering and pagination.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation, ReservationStatus } from '../../domain/Reservation'

export type ListReservationsDto = {
  propertyId: string
  status?: ReservationStatus | undefined
  guestId?: string | undefined
  siteId?: string | undefined
  checkInFrom?: Date | undefined
  checkInTo?: Date | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export type ListReservationsResult = {
  reservations: Reservation[]
  total: number
}

export class ListReservationsQueryHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: ListReservationsDto): Promise<ListReservationsResult> {
    return await this.repository.findByPropertyIdWithFilters(dto.propertyId, {
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.guestId !== undefined && { guestId: dto.guestId }),
      ...(dto.siteId !== undefined && { siteId: dto.siteId }),
      ...(dto.checkInFrom !== undefined && { checkInFrom: dto.checkInFrom }),
      ...(dto.checkInTo !== undefined && { checkInTo: dto.checkInTo }),
      limit: dto.limit || 50,
      offset: dto.offset || 0,
    })
  }
}

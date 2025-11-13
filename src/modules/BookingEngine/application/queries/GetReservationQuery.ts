/**
 * GetReservationQuery
 *
 * Query to retrieve a single reservation by ID or confirmation number.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation } from '../../domain/Reservation'

export type GetReservationDto = {
  id?: string
  confirmationNumber?: string
}

export class GetReservationQueryHandler {
  constructor(private readonly repository: IReservationRepository) {}

  async execute(dto: GetReservationDto): Promise<Reservation | null> {
    // Require either ID or confirmation number
    if (!dto.id && !dto.confirmationNumber) {
      throw new Error('Either id or confirmationNumber must be provided')
    }

    // Find by ID if provided
    if (dto.id) {
      return await this.repository.findById(dto.id)
    }

    // Find by confirmation number
    return await this.repository.findByConfirmationNumber(dto.confirmationNumber!)
  }
}

/**
 * ListGuestsQuery
 *
 * Retrieves all guests for a property.
 */

import { type IGuestRepository } from '../../domain/IGuestRepository'
import { type GuestDTO, GuestDTOMapper } from '../DTOs/GuestDTO'

export interface ListGuestsInput {
  propertyId: string
}

export class ListGuestsQueryHandler {
  constructor(private readonly repository: IGuestRepository) {}

  async execute(input: ListGuestsInput): Promise<GuestDTO[]> {
    const guests = await this.repository.findByPropertyId(input.propertyId)

    return guests.map((guest) => GuestDTOMapper.fromDomain(guest))
  }
}

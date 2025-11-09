/**
 * ListGuestsQuery
 *
 * Retrieves all guests for a property.
 */

import { IGuestRepository } from '../../domain/IGuestRepository'
import { GuestDTO } from '../DTOs/GuestDTO'

export interface ListGuestsInput {
  propertyId: string
}

export class ListGuestsQueryHandler {
  constructor(private readonly repository: IGuestRepository) {}

  async execute(input: ListGuestsInput): Promise<GuestDTO[]> {
    const guests = await this.repository.findByPropertyId(input.propertyId)

    return guests.map((guest) => GuestDTO.fromDomain(guest))
  }
}

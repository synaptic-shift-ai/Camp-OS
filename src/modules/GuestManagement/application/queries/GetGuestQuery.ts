/**
 * GetGuestQuery
 *
 * Retrieves a single guest by ID.
 */

import { IGuestRepository } from '../../domain/IGuestRepository'
import { GuestDTO } from '../DTOs/GuestDTO'

export interface GetGuestInput {
  guestId: string
}

export class GetGuestQueryHandler {
  constructor(private readonly repository: IGuestRepository) {}

  async execute(input: GetGuestInput): Promise<GuestDTO> {
    const guest = await this.repository.findById(input.guestId)

    if (!guest) {
      throw new Error(`Guest not found: ${input.guestId}`)
    }

    return GuestDTO.fromDomain(guest)
  }
}

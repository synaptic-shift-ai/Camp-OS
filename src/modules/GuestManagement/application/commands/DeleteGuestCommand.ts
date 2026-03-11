/**
 * DeleteGuestCommand
 *
 * Soft-deletes a guest by setting deleted_at timestamp.
 * The guest record is preserved to maintain FK integrity with reservations.
 */

import { type IGuestRepository } from '../../domain/IGuestRepository'

export interface DeleteGuestInput {
  guestId: string
  propertyId: string
}

export class DeleteGuestCommandHandler {
  constructor(private readonly repository: IGuestRepository) {}

  async execute(input: DeleteGuestInput): Promise<void> {
    const guest = await this.repository.findById(input.guestId)

    if (!guest) {
      throw new Error(`Guest not found: ${input.guestId}`)
    }

    if (guest.propertyId !== input.propertyId) {
      throw new Error('Guest does not belong to the specified property')
    }

    await this.repository.softDelete(input.guestId)
  }
}

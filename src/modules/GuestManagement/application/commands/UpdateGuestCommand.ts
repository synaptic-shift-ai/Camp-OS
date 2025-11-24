/**
 * UpdateGuestCommand
 *
 * Updates guest information (contact, address, notes).
 */

import { Guest } from '../../domain/Guest'
import { ContactInfo } from '../../domain/ContactInfo'
import { Address } from '../../domain/Address'
import { IGuestRepository } from '../../domain/IGuestRepository'
import { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'

export interface UpdateGuestInput {
  guestId: string
  email?: string | undefined
  phone?: string | undefined
  emergencyContactName?: string | undefined
  emergencyContactPhone?: string | undefined
  address?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  } | null | undefined
  notes?: string | undefined
}

export class UpdateGuestCommandHandler {
  constructor(
    private readonly repository: IGuestRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: UpdateGuestInput): Promise<Guest> {
    // Load existing guest
    const guest = await this.repository.findById(input.guestId)
    if (!guest) {
      throw new Error(`Guest not found: ${input.guestId}`)
    }

    // Update contact info if provided
    if (input.email || input.phone) {
      const emergencyContactName = input.emergencyContactName !== undefined
        ? input.emergencyContactName
        : guest.contact.emergencyContactName
      const emergencyContactPhone = input.emergencyContactPhone !== undefined
        ? input.emergencyContactPhone
        : guest.contact.emergencyContactPhone

      const contact = ContactInfo.create({
        email: input.email || guest.contact.email,
        phone: input.phone || guest.contact.phone,
        ...(emergencyContactName !== undefined && { emergencyContactName }),
        ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
      })
      guest.updateContactInfo(contact)
    }

    // Update address if provided
    if (input.address !== undefined) {
      const address = input.address
        ? Address.create({
            street: input.address.street,
            city: input.address.city,
            state: input.address.state,
            zipCode: input.address.zipCode,
            country: input.address.country,
          })
        : null
      guest.updateAddress(address)
    }

    // Update notes if provided
    if (input.notes !== undefined) {
      guest.addNotes(input.notes)
    }

    // Save changes
    await this.repository.save(guest)

    // Publish domain events
    await this.eventBus.publishAll([...guest.getDomainEvents()])
    guest.clearDomainEvents()

    return guest
  }
}

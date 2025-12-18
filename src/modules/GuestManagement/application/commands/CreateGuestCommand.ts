/**
 * CreateGuestCommand
 *
 * Creates a new guest or returns existing guest if email already exists.
 * Implements duplicate prevention strategy.
 */

import { Guest } from '../../domain/Guest'
import { PersonName } from '../../domain/value-objects/PersonName'
import { ContactInfo } from '../../domain/value-objects/ContactInfo'
import { Address } from '../../domain/value-objects/Address'
import { IGuestRepository } from '../../domain/IGuestRepository'
import { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'

export interface CreateGuestInput {
  propertyId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  } | undefined
  emergencyContactName?: string | undefined
  emergencyContactPhone?: string | undefined
  userId?: string | undefined
  notes?: string | undefined
}

export class CreateGuestCommandHandler {
  constructor(
    private readonly repository: IGuestRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: CreateGuestInput): Promise<Guest> {
    // Create value objects
    const name = PersonName.create({
      firstName: input.firstName,
      lastName: input.lastName,
    })

    const contact = ContactInfo.create({
      email: input.email,
      phone: input.phone,
      ...(input.emergencyContactName !== undefined && { emergencyContactName: input.emergencyContactName }),
      ...(input.emergencyContactPhone !== undefined && { emergencyContactPhone: input.emergencyContactPhone }),
    })

    const address = input.address
      ? Address.create({
          street: input.address.street,
          city: input.address.city,
          state: input.address.state,
          zipCode: input.address.zipCode,
          country: input.address.country,
        })
      : null

    // Check if guest already exists by email (duplicate prevention)
    // Use normalized email from ContactInfo
    const existingGuest = await this.repository.findByEmail(
      input.propertyId,
      contact.email
    )

    if (existingGuest) {
      // Return existing guest (no event published)
      return existingGuest
    }

    // Generate new ID (would use UUID in production)
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create new guest
    const guest = Guest.create({
      id: guestId,
      propertyId: input.propertyId,
      userId: input.userId || null,
      name,
      contact,
      address,
      stripeCustomerId: null,
      notes: input.notes || null,
    })

    // Save to repository
    await this.repository.save(guest)

    // Publish domain events
    await this.eventBus.publishAll([...guest.getDomainEvents()])
    guest.clearDomainEvents()

    return guest
  }
}

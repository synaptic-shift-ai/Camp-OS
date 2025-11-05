/**
 * CreatePropertyCommand
 *
 * Command to create a new property.
 * Validates business rules and delegates to Property aggregate.
 */
import type { IPropertyRepository } from '../../domain/IPropertyRepository'
import { Property } from '../../domain/Property'
import { PropertyType } from '../../domain/PropertyType'
import { PropertySettings } from '../../domain/PropertySettings'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type CreatePropertyDto = {
  id: string
  companyId: string
  ownerId: string | null
  name: string
  slug: string
  description?: string | null
  propertyType?: PropertyType | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  subdomain?: string | null
  bookingPageSlug?: string | null
  settings?: PropertySettings
  amenities?: string[] | null
}

export class CreatePropertyCommandHandler {
  constructor(private readonly repository: IPropertyRepository) {}

  async execute(dto: CreatePropertyDto): Promise<Property> {
    // Check if slug already exists
    const slugExists = await this.repository.existsBySlug(dto.slug)

    if (slugExists) {
      throw new Error(`Property with slug '${dto.slug}' already exists`)
    }

    // Create property aggregate
    const property = Property.create(
      dto.id,
      dto.companyId,
      dto.ownerId,
      dto.name,
      dto.slug,
      {
        description: dto.description,
        propertyType: dto.propertyType,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        country: dto.country,
        phone: dto.phone,
        email: dto.email,
        subdomain: dto.subdomain,
        bookingPageSlug: dto.bookingPageSlug,
        settings: dto.settings,
        amenities: dto.amenities,
      }
    )

    // Save to database
    await this.repository.save(property)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll(property.getDomainEvents())
    property.clearDomainEvents()

    return property
  }
}

/**
 * CreatePropertyCommand
 *
 * Command to create a new property.
 * Validates business rules and delegates to Property aggregate.
 */
import type { IPropertyRepository } from '../../domain/IPropertyRepository'
import { Property, type PropertyAmenity } from '../../domain/Property'
import { type PropertyType } from '../../domain/PropertyType'
import { type PropertySettings } from '../../domain/PropertySettings'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type CreatePropertyDto = {
  id: string
  companyId: string
  ownerId: string | null
  name: string
  slug: string
  description?: string | null | undefined
  // Accept string literals from Zod validation or enum values
  propertyType?: PropertyType | 'campground' | 'rv_park' | 'glamping' | 'cabin_resort' | 'mixed' | null | undefined
  address?: string | null | undefined
  city?: string | null | undefined
  state?: string | null | undefined
  zipCode?: string | null | undefined
  country?: string | null | undefined
  phone?: string | null | undefined
  email?: string | null | undefined
  subdomain?: string | null | undefined
  bookingPageSlug?: string | null | undefined
  settings?: PropertySettings | undefined
  amenities?: PropertyAmenity[] | null | undefined
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
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.propertyType !== undefined && { propertyType: dto.propertyType as PropertyType | null }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.zipCode !== undefined && { zipCode: dto.zipCode }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.subdomain !== undefined && { subdomain: dto.subdomain }),
        ...(dto.bookingPageSlug !== undefined && { bookingPageSlug: dto.bookingPageSlug }),
        ...(dto.settings !== undefined && { settings: dto.settings }),
        ...(dto.amenities !== undefined && { amenities: dto.amenities }),
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

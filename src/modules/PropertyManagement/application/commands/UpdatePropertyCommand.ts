/**
 * UpdatePropertyCommand
 *
 * Command to update property details.
 */
import type { IPropertyRepository } from '../../domain/IPropertyRepository'
import type { Property } from '../../domain/Property'
import { PropertyType } from '../../domain/PropertyType'
import { PropertySettings } from '../../domain/PropertySettings'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type UpdatePropertyDto = {
  id: string
  name?: string
  description?: string | null
  propertyType?: PropertyType | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  country?: string | null
  subdomain?: string | null
  bookingPageSlug?: string | null
  settings?: PropertySettings
  amenities?: string[] | null
}

export class UpdatePropertyCommandHandler {
  constructor(private readonly repository: IPropertyRepository) {}

  async execute(dto: UpdatePropertyDto): Promise<Property> {
    // Load property
    const property = await this.repository.findById(dto.id)

    if (!property) {
      throw new Error(`Property with id '${dto.id}' not found`)
    }

    // Update basic details
    if (
      dto.name !== undefined ||
      dto.description !== undefined ||
      dto.propertyType !== undefined ||
      dto.phone !== undefined ||
      dto.email !== undefined
    ) {
      property.updateDetails({
        name: dto.name,
        description: dto.description,
        propertyType: dto.propertyType,
        phone: dto.phone,
        email: dto.email,
      })
    }

    // Update location
    if (
      dto.address !== undefined ||
      dto.city !== undefined ||
      dto.state !== undefined ||
      dto.zipCode !== undefined ||
      dto.country !== undefined
    ) {
      property.updateLocation({
        address: dto.address,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        country: dto.country,
      })
    }

    // Update branding
    if (dto.subdomain !== undefined || dto.bookingPageSlug !== undefined) {
      property.updateBranding({
        subdomain: dto.subdomain,
        bookingPageSlug: dto.bookingPageSlug,
      })
    }

    // Update settings
    if (dto.settings) {
      property.updateSettings(dto.settings)
    }

    // Update amenities
    if (dto.amenities !== undefined) {
      property.updateAmenities(dto.amenities ?? [])
    }

    // Save to database
    await this.repository.save(property)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll(property.getDomainEvents())
    property.clearDomainEvents()

    return property
  }
}

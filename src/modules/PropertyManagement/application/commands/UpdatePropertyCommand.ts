/**
 * UpdatePropertyCommand
 *
 * Command to update property details.
 */
import type { IPropertyRepository } from '../../domain/IPropertyRepository'
import type { Property } from '../../domain/Property'
import { type PropertyType } from '../../domain/PropertyType'
import { type PropertySettings } from '../../domain/PropertySettings'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type UpdatePropertyDto = {
  id: string
  name?: string | undefined
  description?: string | null | undefined
  // Accept string literals from Zod validation or enum values
  propertyType?: PropertyType | 'campground' | 'rv_park' | 'glamping' | 'cabin_resort' | 'mixed' | null | undefined
  phone?: string | null | undefined
  email?: string | null | undefined
  checkInTime?: string | null | undefined
  checkOutTime?: string | null | undefined
  address?: string | null | undefined
  city?: string | null | undefined
  state?: string | null | undefined
  zipCode?: string | null | undefined
  country?: string | null | undefined
  subdomain?: string | null | undefined
  bookingPageSlug?: string | null | undefined
  heroImageUrl?: string | null | undefined
  settings?: PropertySettings | undefined
  amenities?: string[] | null | undefined
  checkInInstructions?: string | null | undefined
  checkOutInstructions?: string | null | undefined
  houseRules?: string | null | undefined
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
      dto.email !== undefined ||
      dto.checkInTime !== undefined ||
      dto.checkOutTime !== undefined
    ) {
      property.updateDetails({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.propertyType !== undefined && { propertyType: dto.propertyType as PropertyType | null }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.checkInTime !== undefined && { checkInTime: dto.checkInTime }),
        ...(dto.checkOutTime !== undefined && { checkOutTime: dto.checkOutTime }),
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
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.zipCode !== undefined && { zipCode: dto.zipCode }),
        ...(dto.country !== undefined && { country: dto.country }),
      })
    }

    // Update branding
    if (dto.subdomain !== undefined || dto.bookingPageSlug !== undefined || dto.heroImageUrl !== undefined) {
      property.updateBranding({
        ...(dto.subdomain !== undefined && { subdomain: dto.subdomain }),
        ...(dto.bookingPageSlug !== undefined && { bookingPageSlug: dto.bookingPageSlug }),
        ...(dto.heroImageUrl !== undefined && { heroImageUrl: dto.heroImageUrl }),
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

    // Update guest instructions
    if (dto.checkInInstructions !== undefined || dto.checkOutInstructions !== undefined || dto.houseRules !== undefined) {
      property.updateGuestInstructions({
        ...(dto.checkInInstructions !== undefined && { checkInInstructions: dto.checkInInstructions }),
        ...(dto.checkOutInstructions !== undefined && { checkOutInstructions: dto.checkOutInstructions }),
        ...(dto.houseRules !== undefined && { houseRules: dto.houseRules }),
      })
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

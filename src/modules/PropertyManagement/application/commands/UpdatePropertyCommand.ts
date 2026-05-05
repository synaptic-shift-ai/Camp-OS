/**
 * UpdatePropertyCommand
 *
 * Command to update property details.
 */
import type { IPropertyRepository } from '../../domain/IPropertyRepository'
import type { Property } from '../../domain/Property'
import { type PropertyType } from '../../domain/PropertyType'
import { type PropertySettings } from '../../domain/PropertySettings'
import { generateBookingSlug } from '@/lib/booking/slug-utils'

export type PropertyAmenity = {
  id: string
  name: string
  description: string | null
  icon_url?: string | null | undefined
}

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
  galleryImages?: string[] | null | undefined
  settings?: PropertySettings | undefined
  amenities?: PropertyAmenity[] | null | undefined
  site_amenities?: PropertyAmenity[] | null | undefined
  checkInInstructions?: string | null | undefined
  checkOutInstructions?: string | null | undefined
  houseRules?: string | null | undefined
  cancellation_policy?: string | null | undefined
  cancellation_policy_config?: Record<string, any> | null | undefined
  terms_and_conditions?: string | null | undefined
}

export class UpdatePropertyCommandHandler {
  constructor(private readonly repository: IPropertyRepository) {}

  async execute(dto: UpdatePropertyDto): Promise<Property> {
    // Load property
    const property = await this.repository.findById(dto.id)

    if (!property) {
      throw new Error(`Property with id '${dto.id}' not found`)
    }

    let nameChangeSlugs: { nextSlug: string; previousBookingSlug: string | null } | null = null
    if (dto.name !== undefined) {
      const nextName = dto.name.trim()
      if (nextName !== property.name) {
        const nextSlug = generateBookingSlug(nextName, property.id)
        if (await this.repository.slugExistsForOtherProperty(nextSlug, dto.id)) {
          throw new Error(`Property slug '${nextSlug}' is already in use`)
        }
        if (await this.repository.bookingPageSlugExistsForOtherProperty(nextSlug, dto.id)) {
          throw new Error(`Booking page slug '${nextSlug}' is already in use`)
        }
        nameChangeSlugs = {
          nextSlug,
          previousBookingSlug: property.bookingPageSlug,
        }
      }
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

    if (nameChangeSlugs) {
      property.updateBranding({
        slug: nameChangeSlugs.nextSlug,
        bookingPageSlug: nameChangeSlugs.nextSlug,
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

    // Update branding (bookingPageSlug from client is ignored when name-driven slug rename ran)
    if (
      dto.subdomain !== undefined ||
      dto.bookingPageSlug !== undefined ||
      dto.heroImageUrl !== undefined ||
      dto.galleryImages !== undefined
    ) {
      if (!nameChangeSlugs) {
        property.updateBranding({
          ...(dto.subdomain !== undefined && { subdomain: dto.subdomain }),
          ...(dto.bookingPageSlug !== undefined && { bookingPageSlug: dto.bookingPageSlug }),
          ...(dto.heroImageUrl !== undefined && { heroImageUrl: dto.heroImageUrl }),
          ...(dto.galleryImages !== undefined && { galleryImages: dto.galleryImages }),
        })
      } else if (
        dto.subdomain !== undefined ||
        dto.heroImageUrl !== undefined ||
        dto.galleryImages !== undefined
      ) {
        property.updateBranding({
          ...(dto.subdomain !== undefined && { subdomain: dto.subdomain }),
          ...(dto.heroImageUrl !== undefined && { heroImageUrl: dto.heroImageUrl }),
          ...(dto.galleryImages !== undefined && { galleryImages: dto.galleryImages }),
        })
      }
    }

    // Update settings
    if (dto.settings) {
      property.updateSettings(dto.settings)
    }

    // Update amenities
    if (dto.amenities !== undefined) {
      property.updateAmenities(dto.amenities ?? [])
    }

    // Update site amenities
    if (dto.site_amenities !== undefined) {
      property.updateSiteAmenities(dto.site_amenities ?? [])
    }

    // Update guest instructions
    if (dto.checkInInstructions !== undefined || dto.checkOutInstructions !== undefined || dto.houseRules !== undefined) {
      property.updateGuestInstructions({
        ...(dto.checkInInstructions !== undefined && { checkInInstructions: dto.checkInInstructions }),
        ...(dto.checkOutInstructions !== undefined && { checkOutInstructions: dto.checkOutInstructions }),
        ...(dto.houseRules !== undefined && { houseRules: dto.houseRules }),
      })
    }

    // Column overrides for dedicated cancellation / legal text columns (not part of settings)
    const columnOverrides: {
      cancellation_policy?: string | null
      cancellation_policy_config?: Record<string, unknown> | null
      terms_and_conditions?: string | null
    } = {}
    if (dto.cancellation_policy !== undefined) columnOverrides.cancellation_policy = dto.cancellation_policy
    if (dto.cancellation_policy_config !== undefined) columnOverrides.cancellation_policy_config = dto.cancellation_policy_config as Record<string, unknown> | null
    if (dto.terms_and_conditions !== undefined) columnOverrides.terms_and_conditions = dto.terms_and_conditions

    // Save to database
    await this.repository.save(property, Object.keys(columnOverrides).length > 0 ? columnOverrides : undefined)

    if (nameChangeSlugs) {
      const { previousBookingSlug, nextSlug } = nameChangeSlugs
      if (previousBookingSlug && previousBookingSlug !== nextSlug) {
        await this.repository.insertBookingPageSlugAlias(dto.id, previousBookingSlug)
      }
    }

    // Clear domain events
    property.clearDomainEvents()

    return property
  }
}

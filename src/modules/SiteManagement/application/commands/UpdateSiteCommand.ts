/**
 * UpdateSiteCommand
 *
 * Command to update site details.
 */
import { ISiteRepository } from '../../domain/ISiteRepository'
import { Site } from '../../domain/Site'
import { Pricing } from '../../domain/Pricing'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type UpdateSiteDto = {
  siteId: string
  siteName?: string | null
  description?: string | null
  maxOccupancy?: number | null
  maxVehicles?: number | null
  sizeSqft?: number | null
  amenities?: string[] | null
  hookups?: string[] | null
  basePrice?: number // in cents
  weekendPrice?: number // in cents
  images?: string[] | null
  locationMap?: Record<string, any> | null
}

export class UpdateSiteCommandHandler {
  constructor(private readonly repository: ISiteRepository) {}

  async execute(dto: UpdateSiteDto): Promise<Site> {
    // Load site
    const site = await this.repository.findById(dto.siteId)
    if (!site) {
      throw new Error(`Site not found: ${dto.siteId}`)
    }

    // Update details
    site.updateDetails({
      siteName: dto.siteName,
      description: dto.description,
      maxOccupancy: dto.maxOccupancy,
      maxVehicles: dto.maxVehicles,
      sizeSqft: dto.sizeSqft,
      amenities: dto.amenities,
      hookups: dto.hookups,
    })

    // Update pricing if provided (allow partial updates)
    if (dto.basePrice !== undefined || dto.weekendPrice !== undefined) {
      const currentPricing = site.pricing
      const newBasePrice = dto.basePrice !== undefined ? dto.basePrice : currentPricing.basePrice
      const newWeekendPrice = dto.weekendPrice !== undefined ? dto.weekendPrice : currentPricing.weekendPrice
      const newPricing = Pricing.create(newBasePrice, newWeekendPrice, 'USD')
      site.updatePricing(newPricing)
    }

    // Update images if provided
    if (dto.images !== undefined) {
      site.updateImages(dto.images ?? [])
    }

    // Update location map if provided
    if (dto.locationMap !== undefined) {
      site.updateLocationMap(dto.locationMap ?? {})
    }

    // Save
    await this.repository.save(site)

    // Publish events
    const eventBus = getEventBus()
    await eventBus.publishAll(site.getDomainEvents())
    site.clearDomainEvents()

    return site
  }
}

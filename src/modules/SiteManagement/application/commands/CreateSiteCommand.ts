/**
 * CreateSiteCommand
 *
 * Command to create a new site.
 * Validates business rules and delegates to Site aggregate.
 */
import type { ISiteRepository } from '../../domain/ISiteRepository'
import { Site } from '../../domain/Site'
import { type SiteType } from '../../domain/SiteType'
import { type SiteStatus } from '../../domain/SiteStatus'
import { Pricing } from '../../domain/Pricing'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export type CreateSiteDto = {
  id: string
  propertyId: string
  siteNumber: string
  siteName: string | null
  // Accept string literals from Zod validation or enum values
  siteType: SiteType | 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'
  description?: string | null
  basePrice: number // in cents
  weekendPrice: number // in cents
  maxOccupancy?: number | null
  maxVehicles?: number | null
  sizeSqft?: number | null
  status?: SiteStatus | 'available' | 'occupied' | 'reserved' | 'needs_housekeeping' | 'out_of_service' | 'booked'
  amenities?: string[] | null
  hookups?: string[] | null
  images?: string[] | null
  locationMap?: Record<string, any> | null
}

export class CreateSiteCommandHandler {
  constructor(private readonly repository: ISiteRepository) {}

  async execute(dto: CreateSiteDto): Promise<Site> {
    // Check if site number already exists
    const exists = await this.repository.existsBySiteNumber(
      dto.propertyId,
      dto.siteNumber
    )

    if (exists) {
      throw new Error(
        `Site number ${dto.siteNumber} already exists for this property`
      )
    }

    // Create pricing value object
    const pricing = Pricing.create(dto.basePrice, dto.weekendPrice, 'USD')

    // Create site aggregate
    const site = Site.create(
      dto.id,
      dto.propertyId,
      dto.siteNumber,
      dto.siteName,
      dto.siteType as SiteType,
      pricing,
      {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.maxOccupancy !== undefined && { maxOccupancy: dto.maxOccupancy }),
        ...(dto.maxVehicles !== undefined && { maxVehicles: dto.maxVehicles }),
        ...(dto.sizeSqft !== undefined && { sizeSqft: dto.sizeSqft }),
        ...(dto.status !== undefined && { status: dto.status as SiteStatus }),
        ...(dto.amenities !== undefined && { amenities: dto.amenities }),
        ...(dto.hookups !== undefined && { hookups: dto.hookups }),
        ...(dto.images !== undefined && { images: dto.images }),
        ...(dto.locationMap !== undefined && { locationMap: dto.locationMap }),
      }
    )

    // Save to database
    await this.repository.save(site)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll(site.getDomainEvents())
    site.clearDomainEvents()

    return site
  }
}

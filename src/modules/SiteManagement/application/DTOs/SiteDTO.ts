/**
 * SiteDTO
 *
 * Data Transfer Object for Site API responses.
 * Maps from domain entity to API-friendly format.
 */
import { Site } from '../../domain/Site'
import { SiteStatus, SiteStatusLabels } from '../../domain/SiteStatus'
import { SiteType, SiteTypeLabels } from '../../domain/SiteType'

export type SiteDTO = {
  id: string
  propertyId: string
  siteNumber: string
  siteName: string | null
  siteType: SiteType
  siteTypeLabel: string
  description: string | null
  status: SiteStatus
  statusLabel: string
  pricing: {
    basePrice: number // in cents
    weekendPrice: number // in cents
    basePriceFormatted: string
    weekendPriceFormatted: string
    currency: string
  }
  capacity: {
    maxOccupancy: number | null
    maxVehicles: number | null
  }
  sizeSqft: number | null
  amenities: string[] | null
  hookups: string[] | null
  images: string[] | null
  locationMap: Record<string, any> | null
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

/**
 * Map Site domain entity to DTO
 */
export function toSiteDTO(site: Site): SiteDTO {
  return {
    id: site.id,
    propertyId: site.propertyId,
    siteNumber: site.siteNumber,
    siteName: site.siteName,
    siteType: site.siteType,
    siteTypeLabel: SiteTypeLabels[site.siteType],
    description: site.description,
    status: site.status,
    statusLabel: SiteStatusLabels[site.status],
    pricing: {
      basePrice: site.pricing.basePrice,
      weekendPrice: site.pricing.weekendPrice,
      basePriceFormatted: site.pricing.formatBasePrice(),
      weekendPriceFormatted: site.pricing.formatWeekendPrice(),
      currency: site.pricing.currency,
    },
    capacity: {
      maxOccupancy: site.maxOccupancy,
      maxVehicles: site.maxVehicles,
    },
    sizeSqft: site.sizeSqft,
    amenities: site.amenities,
    hookups: site.hookups,
    images: site.images,
    locationMap: site.locationMap,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  }
}

/**
 * Map array of Sites to DTOs
 */
export function toSiteDTOs(sites: Site[]): SiteDTO[] {
  return sites.map(toSiteDTO)
}

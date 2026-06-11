/**
 * ListSitesQuery
 *
 * Query to list sites for a property with optional filters.
 */
import type { ISiteRepository } from '../../domain/ISiteRepository'
import type { Site } from '../../domain/Site'
import type { SiteStatus } from '../../domain/SiteStatus'

export type ListSitesDto = {
  propertyId: string
  // Accept string literals from Zod validation or enum values
  status?: SiteStatus | 'available' | 'occupied' | 'reserved' | 'booked' | 'housekeeping' | 'maintenance' | 'unavailable' | undefined
  siteType?: string | undefined
  availableOnly?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export type ListSitesResult = {
  sites: Site[]
  total: number
}

export class ListSitesQueryHandler {
  constructor(private readonly repository: ISiteRepository) {}

  async execute(dto: ListSitesDto): Promise<ListSitesResult> {
    return await this.repository.findByPropertyIdWithFilters(dto.propertyId, {
      ...(dto.status !== undefined && { status: dto.status as SiteStatus }),
      ...(dto.siteType !== undefined && { siteType: dto.siteType }),
      ...(dto.availableOnly !== undefined && { availableOnly: dto.availableOnly }),
      ...(dto.limit !== undefined && { limit: dto.limit }),
      ...(dto.offset !== undefined && { offset: dto.offset }),
    })
  }
}

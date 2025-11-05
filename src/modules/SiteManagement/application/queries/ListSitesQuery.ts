/**
 * ListSitesQuery
 *
 * Query to list sites for a property with optional filters.
 */
import { ISiteRepository } from '../../domain/ISiteRepository'
import { Site } from '../../domain/Site'
import { SiteStatus } from '../../domain/SiteStatus'

export type ListSitesDto = {
  propertyId: string
  status?: SiteStatus
  siteType?: string
  availableOnly?: boolean
  limit?: number
  offset?: number
}

export type ListSitesResult = {
  sites: Site[]
  total: number
}

export class ListSitesQueryHandler {
  constructor(private readonly repository: ISiteRepository) {}

  async execute(dto: ListSitesDto): Promise<ListSitesResult> {
    return await this.repository.findByPropertyIdWithFilters(dto.propertyId, {
      status: dto.status,
      siteType: dto.siteType,
      availableOnly: dto.availableOnly,
      limit: dto.limit,
      offset: dto.offset,
    })
  }
}

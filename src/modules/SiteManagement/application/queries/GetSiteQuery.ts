/**
 * GetSiteQuery
 *
 * Query to get a single site by ID.
 */
import { type ISiteRepository } from '../../domain/ISiteRepository'
import { type Site } from '../../domain/Site'

export type GetSiteDto = {
  siteId: string
}

export class GetSiteQueryHandler {
  constructor(private readonly repository: ISiteRepository) {}

  async execute(dto: GetSiteDto): Promise<Site | null> {
    return await this.repository.findById(dto.siteId)
  }
}

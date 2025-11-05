/**
 * ListPropertiesQuery
 *
 * Query to list properties with optional filters.
 */
import type { IPropertyRepository } from '../../domain/IPropertyRepository'
import type { Property } from '../../domain/Property'
import type { PropertyStatus } from '../../domain/PropertyStatus'

export type ListPropertiesDto = {
  companyId: string
  status?: PropertyStatus
  onboardingComplete?: boolean
  limit?: number
  offset?: number
}

export type ListPropertiesResult = {
  properties: Property[]
  total: number
  limit: number
  offset: number
}

export class ListPropertiesQueryHandler {
  constructor(private readonly repository: IPropertyRepository) {}

  async execute(dto: ListPropertiesDto): Promise<ListPropertiesResult> {
    const { properties, total } = await this.repository.findByCompanyIdWithFilters(
      dto.companyId,
      {
        status: dto.status,
        onboardingComplete: dto.onboardingComplete,
        limit: dto.limit,
        offset: dto.offset,
      }
    )

    return {
      properties,
      total,
      limit: dto.limit || total,
      offset: dto.offset || 0,
    }
  }
}

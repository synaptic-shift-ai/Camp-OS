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
  status?: PropertyStatus | undefined
  onboardingComplete?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
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
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.onboardingComplete !== undefined && { onboardingComplete: dto.onboardingComplete }),
        ...(dto.limit !== undefined && { limit: dto.limit }),
        ...(dto.offset !== undefined && { offset: dto.offset }),
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

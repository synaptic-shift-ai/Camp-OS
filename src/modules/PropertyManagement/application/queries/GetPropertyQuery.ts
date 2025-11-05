/**
 * GetPropertyQuery
 *
 * Query to retrieve a single property by ID.
 */
import type { IPropertyRepository } from '../../domain/IPropertyRepository'
import type { Property } from '../../domain/Property'

export type GetPropertyDto = {
  id: string
}

export class GetPropertyQueryHandler {
  constructor(private readonly repository: IPropertyRepository) {}

  async execute(dto: GetPropertyDto): Promise<Property | null> {
    return await this.repository.findById(dto.id)
  }
}

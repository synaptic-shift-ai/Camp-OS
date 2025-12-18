/**
 * GetCompanyByOwnerQuery
 *
 * Retrieves a company by owner user ID.
 */

import type { ICompanyRepository } from '../../domain/ICompanyRepository'
import { companyToDTO } from '../DTOs/CompanyDTO'
import type { CompanyDTO } from '../DTOs/CompanyDTO'

export interface GetCompanyByOwnerInput {
  ownerId: string
}

export interface GetCompanyByOwnerResult {
  success: true
  company: CompanyDTO
}

export interface GetCompanyByOwnerError {
  success: false
  error: {
    code: 'NOT_FOUND'
    message: string
  }
}

export type GetCompanyByOwnerOutput = GetCompanyByOwnerResult | GetCompanyByOwnerError

export class GetCompanyByOwnerQueryHandler {
  constructor(private readonly repository: ICompanyRepository) {}

  async execute(input: GetCompanyByOwnerInput): Promise<GetCompanyByOwnerOutput> {
    const company = await this.repository.findByOwnerId(input.ownerId)

    if (!company) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No company found for this user',
        },
      }
    }

    return {
      success: true,
      company: companyToDTO(company),
    }
  }
}

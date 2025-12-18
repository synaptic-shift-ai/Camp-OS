/**
 * GetCompanyQuery
 *
 * Retrieves a company by ID.
 */

import type { ICompanyRepository } from '../../domain/ICompanyRepository'
import { companyToDTO } from '../DTOs/CompanyDTO'
import type { CompanyDTO } from '../DTOs/CompanyDTO'

export interface GetCompanyInput {
  companyId: string
}

export interface GetCompanyResult {
  success: true
  company: CompanyDTO
}

export interface GetCompanyError {
  success: false
  error: {
    code: 'NOT_FOUND'
    message: string
  }
}

export type GetCompanyOutput = GetCompanyResult | GetCompanyError

export class GetCompanyQueryHandler {
  constructor(private readonly repository: ICompanyRepository) {}

  async execute(input: GetCompanyInput): Promise<GetCompanyOutput> {
    const company = await this.repository.findById(input.companyId)

    if (!company) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Company not found',
        },
      }
    }

    return {
      success: true,
      company: companyToDTO(company),
    }
  }
}

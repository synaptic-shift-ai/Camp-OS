/**
 * CreateCompanyCommand
 *
 * Creates a new company for a user.
 */

import { Company } from '../../domain/Company'
import type { ICompanyRepository } from '../../domain/ICompanyRepository'

export interface CreateCompanyInput {
  name: string
  ownerId: string
}

export interface CreateCompanyResult {
  success: true
  company: Company
}

export interface CreateCompanyError {
  success: false
  error: {
    code: 'NAME_TAKEN' | 'ALREADY_HAS_COMPANY' | 'VALIDATION_ERROR'
    message: string
  }
}

export type CreateCompanyOutput = CreateCompanyResult | CreateCompanyError

export class CreateCompanyCommandHandler {
  constructor(
    private readonly repository: ICompanyRepository
  ) {}

  async execute(input: CreateCompanyInput): Promise<CreateCompanyOutput> {
    // Check if user already has a company
    const existingCompany = await this.repository.findByOwnerId(input.ownerId)
    if (existingCompany) {
      return {
        success: false,
        error: {
          code: 'ALREADY_HAS_COMPANY',
          message: 'User already owns a company',
        },
      }
    }

    // Check if name is taken
    const nameTaken = await this.repository.isNameTaken(input.name)
    if (nameTaken) {
      return {
        success: false,
        error: {
          code: 'NAME_TAKEN',
          message: 'Company name is already taken',
        },
      }
    }

    // Generate company ID
    const companyId = crypto.randomUUID()

    // Create company
    const company = Company.create({
      id: companyId,
      name: input.name,
      ownerId: input.ownerId,
    })

    // Save to repository
    await this.repository.save(company)

    // Clear domain events
    company.clearDomainEvents()

    return {
      success: true,
      company,
    }
  }
}

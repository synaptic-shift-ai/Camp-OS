/**
 * UpdateCompanyCommand
 *
 * Updates company details.
 */

import type { Company } from '../../domain/Company'
import type { ICompanyRepository } from '../../domain/ICompanyRepository'
import type { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'

export interface UpdateCompanyInput {
  companyId: string
  name?: string
  companyLogoUrl?: string | null
}

export interface UpdateCompanyResult {
  success: true
  company: Company
}

export interface UpdateCompanyError {
  success: false
  error: {
    code: 'NOT_FOUND' | 'NAME_TAKEN' | 'VALIDATION_ERROR'
    message: string
  }
}

export type UpdateCompanyOutput = UpdateCompanyResult | UpdateCompanyError

export class UpdateCompanyCommandHandler {
  constructor(
    private readonly repository: ICompanyRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: UpdateCompanyInput): Promise<UpdateCompanyOutput> {
    // Find company
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

    // Update name if provided
    if (input.name !== undefined) {
      // Check if name is taken (excluding current company)
      const nameTaken = await this.repository.isNameTaken(input.name, input.companyId)
      if (nameTaken) {
        return {
          success: false,
          error: {
            code: 'NAME_TAKEN',
            message: 'Company name is already taken',
          },
        }
      }

      company.updateName(input.name)
    }

    if (input.companyLogoUrl !== undefined) {
      company.updateCompanyLogoUrl(input.companyLogoUrl)
    }

    // Save changes
    await this.repository.save(company)

    // Publish domain events
    await this.eventBus.publishAll([...company.getDomainEvents()])
    company.clearDomainEvents()

    return {
      success: true,
      company,
    }
  }
}

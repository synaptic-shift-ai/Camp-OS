/**
 * GenerateInviteTokenCommand
 *
 * Generates an invite token for a company.
 */

import type { Company } from '../../domain/Company'
import type { ICompanyRepository } from '../../domain/ICompanyRepository'
import type { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'
import type { OnboardingToken } from '../../domain/value-objects/OnboardingToken'

export interface GenerateInviteTokenInput {
  companyId: string
}

export interface GenerateInviteTokenResult {
  success: true
  company: Company
  token: OnboardingToken
}

export interface GenerateInviteTokenError {
  success: false
  error: {
    code: 'NOT_FOUND'
    message: string
  }
}

export type GenerateInviteTokenOutput = GenerateInviteTokenResult | GenerateInviteTokenError

export class GenerateInviteTokenCommandHandler {
  constructor(
    private readonly repository: ICompanyRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: GenerateInviteTokenInput): Promise<GenerateInviteTokenOutput> {
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

    // Generate invite token
    const token = company.generateInviteToken()

    // Save changes
    await this.repository.save(company)

    // Publish domain events
    await this.eventBus.publishAll([...company.getDomainEvents()])
    company.clearDomainEvents()

    return {
      success: true,
      company,
      token,
    }
  }
}

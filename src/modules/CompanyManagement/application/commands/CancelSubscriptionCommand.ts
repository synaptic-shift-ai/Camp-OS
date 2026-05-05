/**
 * CancelSubscriptionCommand
 *
 * Cancels a company's subscription (usually triggered by Stripe webhook or user request).
 */

import type { Company } from '../../domain/Company'
import type { ICompanyRepository } from '../../domain/ICompanyRepository'

export interface CancelSubscriptionInput {
  companyId: string
  reason?: string
}

export interface CancelSubscriptionResult {
  success: true
  company: Company
}

export interface CancelSubscriptionError {
  success: false
  error: {
    code: 'NOT_FOUND' | 'NO_ACTIVE_SUBSCRIPTION'
    message: string
  }
}

export type CancelSubscriptionOutput = CancelSubscriptionResult | CancelSubscriptionError

export class CancelSubscriptionCommandHandler {
  constructor(
    private readonly repository: ICompanyRepository
  ) {}

  async execute(input: CancelSubscriptionInput): Promise<CancelSubscriptionOutput> {
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

    // Cancel subscription
    try {
      company.cancelSubscription(input.reason)
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'NO_ACTIVE_SUBSCRIPTION',
          message: err instanceof Error ? err.message : 'No active subscription',
        },
      }
    }

    // Save changes
    await this.repository.save(company)

    // Clear domain events
    company.clearDomainEvents()

    return {
      success: true,
      company,
    }
  }
}

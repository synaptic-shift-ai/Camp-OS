/**
 * GetSubscriptionStatusQuery
 *
 * Retrieves just the subscription status for a company.
 */

import type { ICompanyRepository } from '../../domain/ICompanyRepository'
import type { SubscriptionDTO } from '../DTOs/CompanyDTO'

export interface GetSubscriptionStatusInput {
  companyId: string
}

export interface GetSubscriptionStatusResult {
  success: true
  subscription: SubscriptionDTO
}

export interface GetSubscriptionStatusError {
  success: false
  error: {
    code: 'NOT_FOUND'
    message: string
  }
}

export type GetSubscriptionStatusOutput = GetSubscriptionStatusResult | GetSubscriptionStatusError

export class GetSubscriptionStatusQueryHandler {
  constructor(private readonly repository: ICompanyRepository) {}

  async execute(input: GetSubscriptionStatusInput): Promise<GetSubscriptionStatusOutput> {
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
      subscription: {
        plan: company.subscriptionPlan.value,
        status: company.subscriptionStatus.value,
        billingCycle: company.billingCycle.value,
        isActive: company.hasActiveSubscription,
        isPaid: company.isPaid,
        stripeCustomerId: company.stripeCustomerId,
        subscriptionId: company.subscriptionId,
        createdAt: company.subscriptionCreatedAt?.toISOString() || null,
        canceledAt: company.subscriptionCanceledAt?.toISOString() || null,
      },
    }
  }
}

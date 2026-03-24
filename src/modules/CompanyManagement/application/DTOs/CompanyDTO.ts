/**
 * Company Data Transfer Object
 *
 * Flattened representation of Company aggregate for API responses.
 */

import type { Company } from '../../domain/Company'

export interface SubscriptionDTO {
  plan: string
  status: string
  billingCycle: string
  isActive: boolean
  isPaid: boolean
  stripeCustomerId: string | null
  subscriptionId: string | null
  createdAt: string | null
  canceledAt: string | null
}

export interface OnboardingTokenDTO {
  token: string
  expiresAt: string
  isValid: boolean
  isUsed: boolean
}

export interface CompanyDTO {
  id: string
  name: string
  companyLogoUrl: string | null
  ownerId: string
  subscription: SubscriptionDTO
  onboardingToken: OnboardingTokenDTO | null
  propertyLimit: number
  createdAt: string
  updatedAt: string
}

export function companyToDTO(company: Company): CompanyDTO {
  return {
    id: company.id,
    name: company.name.value,
    companyLogoUrl: company.companyLogoUrl,
    ownerId: company.ownerId,
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
    onboardingToken: company.onboardingToken
      ? {
          token: company.onboardingToken.value,
          expiresAt: company.onboardingToken.expiresAt.toISOString(),
          isValid: company.onboardingToken.isValid,
          isUsed: company.onboardingToken.isUsed,
        }
      : null,
    propertyLimit: company.subscriptionPlan.propertyLimit,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  }
}

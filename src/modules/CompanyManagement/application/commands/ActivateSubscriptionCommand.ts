/**
 * ActivateSubscriptionCommand
 *
 * Activates a subscription for a company (usually triggered by Stripe webhook).
 */

import type { Company } from '../../domain/Company'
import type { ICompanyRepository } from '../../domain/ICompanyRepository'
import type { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'
import { SubscriptionPlan } from '../../domain/value-objects/SubscriptionPlan'
import { BillingCycle } from '../../domain/value-objects/BillingCycle'

export interface ActivateSubscriptionInput {
  companyId: string
  stripeCustomerId: string
  subscriptionId: string
  plan: string
  billingCycle: string
}

export interface ActivateSubscriptionResult {
  success: true
  company: Company
}

export interface ActivateSubscriptionError {
  success: false
  error: {
    code: 'NOT_FOUND' | 'ALREADY_ACTIVE' | 'INVALID_PLAN' | 'INVALID_BILLING_CYCLE'
    message: string
  }
}

export type ActivateSubscriptionOutput = ActivateSubscriptionResult | ActivateSubscriptionError

export class ActivateSubscriptionCommandHandler {
  constructor(
    private readonly repository: ICompanyRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: ActivateSubscriptionInput): Promise<ActivateSubscriptionOutput> {
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

    // Parse plan
    let plan: SubscriptionPlan
    try {
      plan = SubscriptionPlan.fromString(input.plan)
    } catch {
      return {
        success: false,
        error: {
          code: 'INVALID_PLAN',
          message: `Invalid subscription plan: ${input.plan}`,
        },
      }
    }

    // Parse billing cycle
    let billingCycle: BillingCycle
    try {
      billingCycle = BillingCycle.fromString(input.billingCycle)
    } catch {
      return {
        success: false,
        error: {
          code: 'INVALID_BILLING_CYCLE',
          message: `Invalid billing cycle: ${input.billingCycle}`,
        },
      }
    }

    // Activate subscription
    try {
      company.activateSubscription(
        input.stripeCustomerId,
        input.subscriptionId,
        plan,
        billingCycle
      )
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'ALREADY_ACTIVE',
          message: err instanceof Error ? err.message : 'Subscription already active',
        },
      }
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

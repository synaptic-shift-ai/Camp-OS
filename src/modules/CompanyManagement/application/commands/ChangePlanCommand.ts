/**
 * ChangePlanCommand
 *
 * Changes a company's subscription plan.
 */

import type { Company } from '../../domain/Company'
import type { ICompanyRepository } from '../../domain/ICompanyRepository'
import type { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'
import { SubscriptionPlan } from '../../domain/value-objects/SubscriptionPlan'
import { BillingCycle } from '../../domain/value-objects/BillingCycle'

export interface ChangePlanInput {
  companyId: string
  newPlan: string
  billingCycle?: string
}

export interface ChangePlanResult {
  success: true
  company: Company
  isUpgrade: boolean
}

export interface ChangePlanError {
  success: false
  error: {
    code: 'NOT_FOUND' | 'NO_ACTIVE_SUBSCRIPTION' | 'SAME_PLAN' | 'INVALID_PLAN' | 'INVALID_BILLING_CYCLE'
    message: string
  }
}

export type ChangePlanOutput = ChangePlanResult | ChangePlanError

export class ChangePlanCommandHandler {
  constructor(
    private readonly repository: ICompanyRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: ChangePlanInput): Promise<ChangePlanOutput> {
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

    // Parse new plan
    let newPlan: SubscriptionPlan
    try {
      newPlan = SubscriptionPlan.fromString(input.newPlan)
    } catch {
      return {
        success: false,
        error: {
          code: 'INVALID_PLAN',
          message: `Invalid subscription plan: ${input.newPlan}`,
        },
      }
    }

    // Parse billing cycle if provided
    let billingCycle: BillingCycle | undefined
    if (input.billingCycle) {
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
    }

    // Determine if upgrade
    const isUpgrade = company.subscriptionPlan.canUpgradeTo(newPlan)

    // Change plan
    try {
      company.changePlan(newPlan, billingCycle)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change plan'

      if (message.includes('Already on this plan')) {
        return {
          success: false,
          error: {
            code: 'SAME_PLAN',
            message,
          },
        }
      }

      return {
        success: false,
        error: {
          code: 'NO_ACTIVE_SUBSCRIPTION',
          message,
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
      isUpgrade,
    }
  }
}

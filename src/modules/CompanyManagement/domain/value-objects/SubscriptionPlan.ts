/**
 * SubscriptionPlan Value Object
 *
 * Represents the subscription tier for a company.
 * Each plan has different limits and features.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export type SubscriptionPlanType = 'free' | 'starter' | 'professional' | 'enterprise'

interface SubscriptionPlanProps {
  value: SubscriptionPlanType
}

interface PlanLimits {
  propertyLimit: number
  sitesPerProperty: number
  staffPerProperty: number
  hasAdvancedReporting: boolean
  hasChannelManagement: boolean
  hasDynamicPricing: boolean
}

const PLAN_LIMITS: Record<SubscriptionPlanType, PlanLimits> = {
  free: {
    propertyLimit: 1,
    sitesPerProperty: 10,
    staffPerProperty: 1,
    hasAdvancedReporting: false,
    hasChannelManagement: false,
    hasDynamicPricing: false,
  },
  starter: {
    propertyLimit: 1,
    sitesPerProperty: 50,
    staffPerProperty: 3,
    hasAdvancedReporting: false,
    hasChannelManagement: false,
    hasDynamicPricing: false,
  },
  professional: {
    propertyLimit: 3,
    sitesPerProperty: 200,
    staffPerProperty: 10,
    hasAdvancedReporting: true,
    hasChannelManagement: true,
    hasDynamicPricing: false,
  },
  enterprise: {
    propertyLimit: Infinity,
    sitesPerProperty: Infinity,
    staffPerProperty: Infinity,
    hasAdvancedReporting: true,
    hasChannelManagement: true,
    hasDynamicPricing: true,
  },
}

export class SubscriptionPlan extends ValueObject<SubscriptionPlanProps> {
  public static readonly FREE = new SubscriptionPlan({ value: 'free' })
  public static readonly STARTER = new SubscriptionPlan({ value: 'starter' })
  public static readonly PROFESSIONAL = new SubscriptionPlan({ value: 'professional' })
  public static readonly ENTERPRISE = new SubscriptionPlan({ value: 'enterprise' })

  /**
   * Get the plan type value
   */
  get value(): SubscriptionPlanType {
    return this.props.value
  }

  /**
   * Factory method to create from string value
   *
   * @param plan - Plan type string
   * @returns SubscriptionPlan instance
   * @throws Error if invalid plan
   */
  public static fromString(plan: string | null): SubscriptionPlan {
    if (!plan) {
      return SubscriptionPlan.FREE
    }

    const normalized = plan.toLowerCase() as SubscriptionPlanType

    switch (normalized) {
      case 'free':
        return SubscriptionPlan.FREE
      case 'starter':
        return SubscriptionPlan.STARTER
      case 'professional':
        return SubscriptionPlan.PROFESSIONAL
      case 'enterprise':
        return SubscriptionPlan.ENTERPRISE
      default:
        throw new Error(`Invalid subscription plan: ${plan}`)
    }
  }

  /**
   * Get the limits for this plan
   */
  get limits(): PlanLimits {
    return PLAN_LIMITS[this.props.value]
  }

  /**
   * Get the property limit for this plan
   */
  get propertyLimit(): number {
    return this.limits.propertyLimit
  }

  /**
   * Check if this plan is a paid plan
   */
  get isPaid(): boolean {
    return this.props.value !== 'free'
  }

  /**
   * Check if this plan can be upgraded to the target plan
   */
  public canUpgradeTo(target: SubscriptionPlan): boolean {
    const order: SubscriptionPlanType[] = ['free', 'starter', 'professional', 'enterprise']
    const currentIndex = order.indexOf(this.props.value)
    const targetIndex = order.indexOf(target.props.value)
    return targetIndex > currentIndex
  }

  /**
   * Check if this plan can be downgraded to the target plan
   */
  public canDowngradeTo(target: SubscriptionPlan): boolean {
    const order: SubscriptionPlanType[] = ['free', 'starter', 'professional', 'enterprise']
    const currentIndex = order.indexOf(this.props.value)
    const targetIndex = order.indexOf(target.props.value)
    return targetIndex < currentIndex
  }

  public override toString(): string {
    return this.props.value
  }
}

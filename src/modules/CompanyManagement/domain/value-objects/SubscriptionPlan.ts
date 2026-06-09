/**
 * SubscriptionPlan Value Object
 *
 * Represents the subscription tier for a company.
 * Each plan has different limits and features.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export type SubscriptionPlanType = 'starter' | 'growth' | 'pro' | 'enterprise'

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
  starter: {
    propertyLimit: 1,
    sitesPerProperty: 50,
    staffPerProperty: 3,
    hasAdvancedReporting: false,
    hasChannelManagement: false,
    hasDynamicPricing: false,
  },
  growth: {
    propertyLimit: 3,
    sitesPerProperty: 200,
    staffPerProperty: 10,
    hasAdvancedReporting: true,
    hasChannelManagement: true,
    hasDynamicPricing: false,
  },
  pro: {
    propertyLimit: 10,
    sitesPerProperty: 500,
    staffPerProperty: 25,
    hasAdvancedReporting: true,
    hasChannelManagement: true,
    hasDynamicPricing: true,
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
  private static _freeFallback: SubscriptionPlan | null = null

  private static get freeFallback(): SubscriptionPlan {
    if (!SubscriptionPlan._freeFallback) {
      SubscriptionPlan._freeFallback = new SubscriptionPlan({ value: 'starter' })
    }
    return SubscriptionPlan._freeFallback
  }

  public static readonly STARTER = new SubscriptionPlan({ value: 'starter' })
  public static readonly GROWTH = new SubscriptionPlan({ value: 'growth' })
  public static readonly PRO = new SubscriptionPlan({ value: 'pro' })
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
      return SubscriptionPlan.freeFallback
    }

    const normalized = plan.toLowerCase() as SubscriptionPlanType

    switch (normalized) {
      case 'starter':
        return SubscriptionPlan.STARTER
      case 'growth':
        return SubscriptionPlan.GROWTH
      case 'pro':
        return SubscriptionPlan.PRO
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
   * All persistable plans are paid.
   */
  get isPaid(): boolean {
    return true
  }

  /**
   * Check if this plan can be upgraded to the target plan
   */
  public canUpgradeTo(target: SubscriptionPlan): boolean {
    const order: SubscriptionPlanType[] = ['starter', 'growth', 'pro', 'enterprise']
    const currentIndex = order.indexOf(this.props.value)
    const targetIndex = order.indexOf(target.props.value)
    return targetIndex > currentIndex
  }

  /**
   * Check if this plan can be downgraded to the target plan
   */
  public canDowngradeTo(target: SubscriptionPlan): boolean {
    const order: SubscriptionPlanType[] = ['starter', 'growth', 'pro', 'enterprise']
    const currentIndex = order.indexOf(this.props.value)
    const targetIndex = order.indexOf(target.props.value)
    return targetIndex < currentIndex
  }

  public override toString(): string {
    return this.props.value
  }
}

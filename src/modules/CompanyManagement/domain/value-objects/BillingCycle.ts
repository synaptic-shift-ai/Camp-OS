/**
 * BillingCycle Value Object
 *
 * Represents the billing frequency for a subscription.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export type BillingCycleType = 'monthly' | 'yearly'

interface BillingCycleProps {
  value: BillingCycleType
}

export class BillingCycle extends ValueObject<BillingCycleProps> {
  public static readonly MONTHLY = new BillingCycle({ value: 'monthly' })
  public static readonly YEARLY = new BillingCycle({ value: 'yearly' })

  /**
   * Get the billing cycle value
   */
  get value(): BillingCycleType {
    return this.props.value
  }

  /**
   * Factory method to create from string value
   *
   * @param cycle - Billing cycle string
   * @returns BillingCycle instance
   * @throws Error if invalid cycle
   */
  public static fromString(cycle: string | null): BillingCycle {
    if (!cycle) {
      return BillingCycle.MONTHLY
    }

    const normalized = cycle.toLowerCase() as BillingCycleType

    switch (normalized) {
      case 'monthly':
        return BillingCycle.MONTHLY
      case 'yearly':
        return BillingCycle.YEARLY
      default:
        throw new Error(`Invalid billing cycle: ${cycle}`)
    }
  }

  /**
   * Check if this is yearly billing
   */
  get isYearly(): boolean {
    return this.props.value === 'yearly'
  }

  /**
   * Get the number of months in the billing period
   */
  get monthsInPeriod(): number {
    return this.props.value === 'yearly' ? 12 : 1
  }

  /**
   * Get the discount percentage for yearly billing
   * (typically 2 months free = ~17% off)
   */
  get discountPercentage(): number {
    return this.props.value === 'yearly' ? 17 : 0
  }

  public override toString(): string {
    return this.props.value
  }
}

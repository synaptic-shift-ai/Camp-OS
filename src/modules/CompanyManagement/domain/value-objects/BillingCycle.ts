/**
 * BillingCycle Value Object
 *
 * Represents the billing frequency for a subscription.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export type BillingCycleType = 'monthly' | 'annual'

interface BillingCycleProps {
  value: BillingCycleType
}

export class BillingCycle extends ValueObject<BillingCycleProps> {
  public static readonly MONTHLY = new BillingCycle({ value: 'monthly' })
  public static readonly ANNUAL = new BillingCycle({ value: 'annual' })

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
      case 'annual':
        return BillingCycle.ANNUAL
      default:
        throw new Error(`Invalid billing cycle: ${cycle}`)
    }
  }

  /**
   * Check if this is annual billing
   */
  get isAnnual(): boolean {
    return this.props.value === 'annual'
  }

  /**
   * Get the number of months in the billing period
   */
  get monthsInPeriod(): number {
    return this.props.value === 'annual' ? 12 : 1
  }

  /**
   * Get the discount percentage for annual billing
   * (typically 2 months free = ~17% off)
   */
  get discountPercentage(): number {
    return this.props.value === 'annual' ? 17 : 0
  }

  public override toString(): string {
    return this.props.value
  }
}

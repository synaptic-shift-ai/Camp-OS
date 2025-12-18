/**
 * SubscriptionStatus Value Object
 *
 * Represents the current status of a company's subscription.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export type SubscriptionStatusType =
  | 'trial'
  | 'active'
  | 'cancelled'
  | 'past_due'
  | 'incomplete'
  | 'paused'

interface SubscriptionStatusProps {
  value: SubscriptionStatusType
}

export class SubscriptionStatus extends ValueObject<SubscriptionStatusProps> {
  public static readonly TRIAL = new SubscriptionStatus({ value: 'trial' })
  public static readonly ACTIVE = new SubscriptionStatus({ value: 'active' })
  public static readonly CANCELLED = new SubscriptionStatus({ value: 'cancelled' })
  public static readonly PAST_DUE = new SubscriptionStatus({ value: 'past_due' })
  public static readonly INCOMPLETE = new SubscriptionStatus({ value: 'incomplete' })
  public static readonly PAUSED = new SubscriptionStatus({ value: 'paused' })

  /**
   * Get the status value
   */
  get value(): SubscriptionStatusType {
    return this.props.value
  }

  /**
   * Factory method to create from string value
   *
   * @param status - Status string
   * @returns SubscriptionStatus instance
   * @throws Error if invalid status
   */
  public static fromString(status: string | null): SubscriptionStatus {
    if (!status) {
      return SubscriptionStatus.TRIAL
    }

    const normalized = status.toLowerCase() as SubscriptionStatusType

    switch (normalized) {
      case 'trial':
        return SubscriptionStatus.TRIAL
      case 'active':
        return SubscriptionStatus.ACTIVE
      case 'cancelled':
        return SubscriptionStatus.CANCELLED
      case 'past_due':
        return SubscriptionStatus.PAST_DUE
      case 'incomplete':
        return SubscriptionStatus.INCOMPLETE
      case 'paused':
        return SubscriptionStatus.PAUSED
      default:
        throw new Error(`Invalid subscription status: ${status}`)
    }
  }

  /**
   * Check if this is an active subscription (can use the service)
   */
  get isUsable(): boolean {
    return (
      this.props.value === 'trial' ||
      this.props.value === 'active' ||
      this.props.value === 'past_due' // Grace period
    )
  }

  /**
   * Check if subscription allows new features
   */
  get canAccessPremiumFeatures(): boolean {
    return this.props.value === 'active'
  }

  /**
   * Check if subscription is in a billing issue state
   */
  get hasBillingIssue(): boolean {
    return (
      this.props.value === 'past_due' ||
      this.props.value === 'incomplete'
    )
  }

  /**
   * Check if subscription is terminated
   */
  get isTerminated(): boolean {
    return this.props.value === 'cancelled'
  }

  public override toString(): string {
    return this.props.value
  }
}

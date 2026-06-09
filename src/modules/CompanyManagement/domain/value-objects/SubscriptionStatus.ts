/**
 * SubscriptionStatus Value Object
 *
 * Represents the current status of a company's subscription.
 * Persistable types match the DB CHECK constraint.
 * Domain-only transient states (trial, paused) are valid in the domain
 * but not stored in the database.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

/** Persistable subscription status values (DB-compatible) */
export type SubscriptionStatusType =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'incomplete'

/** All subscription status values including domain-only transient states */
type SubscriptionStatusAll =
  | SubscriptionStatusType
  | 'trial'
  | 'paused'

interface SubscriptionStatusProps {
  value: SubscriptionStatusAll
}

export class SubscriptionStatus extends ValueObject<SubscriptionStatusProps> {
  public static readonly ACTIVE = new SubscriptionStatus({ value: 'active' })
  public static readonly CANCELED = new SubscriptionStatus({ value: 'canceled' })
  public static readonly PAST_DUE = new SubscriptionStatus({ value: 'past_due' })
  public static readonly UNPAID = new SubscriptionStatus({ value: 'unpaid' })
  public static readonly INCOMPLETE = new SubscriptionStatus({ value: 'incomplete' })
  /** Domain-only transient states — not persistable to DB */
  public static readonly TRIAL = new SubscriptionStatus({ value: 'trial' })
  public static readonly PAUSED = new SubscriptionStatus({ value: 'paused' })

  /**
   * Get the status value
   */
  get value(): SubscriptionStatusAll {
    return this.props.value
  }

  /**
   * Whether this status is a DB-compatible persistable value
   */
  get isPersistable(): boolean {
    return (
      this.props.value === 'active' ||
      this.props.value === 'canceled' ||
      this.props.value === 'past_due' ||
      this.props.value === 'unpaid' ||
      this.props.value === 'incomplete'
    )
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

    const normalized = status.toLowerCase() as SubscriptionStatusAll

    switch (normalized) {
      case 'active':
        return SubscriptionStatus.ACTIVE
      case 'canceled':
        return SubscriptionStatus.CANCELED
      case 'past_due':
        return SubscriptionStatus.PAST_DUE
      case 'unpaid':
        return SubscriptionStatus.UNPAID
      case 'incomplete':
        return SubscriptionStatus.INCOMPLETE
      case 'trial':
        return SubscriptionStatus.TRIAL
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
    return this.props.value === 'canceled'
  }

  public override toString(): string {
    return this.props.value
  }
}

/**
 * Minimum Deposit Confirmation Policy
 *
 * Requires a configurable percentage of the total as a deposit
 * before confirmation. Remaining balance is due at check-in.
 *
 * Use case: Standard campground booking with deposits
 */

import { MoneyAmount } from '../../value-objects/MoneyAmount'
import type {
  IConfirmationPolicy,
  ConfirmationContext,
  PolicyResult,
} from '../IConfirmationPolicy'

export interface MinimumDepositPolicyConfig {
  /**
   * Minimum deposit percentage (0-100)
   * Default: 25 (25% deposit required)
   */
  minimumDepositPercent: number
}

export class MinimumDepositPolicy implements IConfirmationPolicy {
  readonly policyType = 'minimum_deposit'

  private readonly config: MinimumDepositPolicyConfig

  constructor(config?: Partial<MinimumDepositPolicyConfig>) {
    this.config = {
      minimumDepositPercent: config?.minimumDepositPercent ?? 25,
    }

    // Validate config
    if (this.config.minimumDepositPercent < 0 || this.config.minimumDepositPercent > 100) {
      throw new Error('minimumDepositPercent must be between 0 and 100')
    }
  }

  canConfirm(context: ConfirmationContext): PolicyResult {
    const { reservation } = context

    // Admin override bypasses payment check
    if (context.isAdminOverride) {
      return { allowed: true }
    }

    // Calculate minimum required
    const minimumRequired = this.calculateMinimumDeposit(reservation.totalAmount)

    // Check if payment meets minimum
    if (reservation.paidAmount.isLessThan(minimumRequired)) {
      const stillNeeded = minimumRequired.subtract(reservation.paidAmount)
      return {
        allowed: false,
        reason: `Minimum deposit of ${this.config.minimumDepositPercent}% (${minimumRequired.formatAsDollars()}) is required. Please pay an additional ${stillNeeded.formatAsDollars()}.`,
        code: 'BELOW_MINIMUM_DEPOSIT',
        minimumRequired,
      }
    }

    return { allowed: true }
  }

  describe(): string {
    return `Requires minimum ${this.config.minimumDepositPercent}% deposit before reservation can be confirmed`
  }

  /**
   * Calculate the minimum deposit amount
   */
  private calculateMinimumDeposit(totalAmount: MoneyAmount): MoneyAmount {
    const depositCents = Math.ceil(
      totalAmount.amountInCents * (this.config.minimumDepositPercent / 100)
    )
    return MoneyAmount.create(depositCents)
  }

  /**
   * Get the configured deposit percentage
   */
  get depositPercent(): number {
    return this.config.minimumDepositPercent
  }
}

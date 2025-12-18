/**
 * Price Adjustment Interface
 *
 * Defines the contract for modifying calculated prices.
 * Adjustments are applied after the base pricing strategy
 * calculates the initial price.
 *
 * This is an extension point for:
 * - PaymentBasedAdjustment: Discount for paying upfront
 * - LoyaltyAdjustment: Discounts for returning guests
 * - PromoCodeAdjustment: Promotional discounts
 * - SeasonalAdjustment: Peak/off-peak rate modifications
 * - MLAdjustment: Dynamic adjustments from ML models
 *
 * Adjustments are composable - multiple can be applied in sequence.
 */

import type { MoneyAmount } from '../value-objects/MoneyAmount'
import type { PricingResult, PricingContext, PriceLineItem } from './IPricingStrategy'

/**
 * Context for adjustment calculation
 * Extends PricingContext with the current pricing result
 */
export interface AdjustmentContext extends PricingContext {
  currentPrice: PricingResult
  // Additional context for adjustments
  promoCode?: string
  guestLoyaltyTier?: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'
  isReturningGuest?: boolean
  previousStays?: number
}

/**
 * Result of an adjustment evaluation
 */
export type AdjustmentResult =
  | {
      applied: true
      adjustment: PriceLineItem
      newTotal: MoneyAmount
      reason: string
    }
  | {
      applied: false
      reason: string
    }

/**
 * Price adjustment interface
 *
 * Implementations should be stateless and composable.
 * Each adjustment focuses on a single concern.
 */
export interface IPriceAdjustment {
  /**
   * Unique identifier for this adjustment type
   */
  readonly adjustmentType: string

  /**
   * Priority for adjustment ordering (lower = applied first)
   * Useful when adjustment order matters (e.g., discounts before taxes)
   */
  readonly priority: number

  /**
   * Whether this adjustment can stack with others of the same type
   */
  readonly stackable: boolean

  /**
   * Evaluate and apply the adjustment
   *
   * @param context - Current pricing and booking context
   * @returns The adjustment result
   */
  apply(context: AdjustmentContext): AdjustmentResult

  /**
   * Check if this adjustment is applicable to the context
   * Called before apply() to filter relevant adjustments
   */
  isApplicable(context: AdjustmentContext): boolean

  /**
   * Human-readable description of this adjustment
   */
  describe(): string
}

/**
 * Utility type for adjustment configuration
 * Used by property settings to enable/configure adjustments
 */
export interface AdjustmentConfig {
  type: string
  enabled: boolean
  priority?: number
  parameters?: Record<string, unknown>
}

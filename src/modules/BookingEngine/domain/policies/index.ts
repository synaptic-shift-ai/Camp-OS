/**
 * Booking Engine Policy Interfaces
 *
 * Extension points for customizable business rules:
 * - Confirmation policies: When can a reservation be confirmed?
 * - Pricing strategies: How is the price calculated?
 * - Price adjustments: Discounts, fees, dynamic pricing
 * - Strategy providers: Resolve which strategies to use
 */

// Confirmation policies
export type {
  IConfirmationPolicy,
  ConfirmationContext,
  PolicyResult,
  ConfirmationDenialCode,
} from './IConfirmationPolicy'

// Pricing strategies
export type {
  IPricingStrategy,
  PricingContext,
  PricingResult,
  PriceLineItem,
  PaymentIntent,
} from './IPricingStrategy'

// Price adjustments
export type {
  IPriceAdjustment,
  AdjustmentContext,
  AdjustmentResult,
  AdjustmentConfig,
} from './IPriceAdjustment'

// Strategy providers
export type {
  IStrategyProvider,
  IStrategyRegistry,
  PropertyStrategyConfig,
} from './IStrategyProvider'

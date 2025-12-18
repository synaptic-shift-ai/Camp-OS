/**
 * Pricing Strategy Interface
 *
 * Defines the contract for calculating reservation prices.
 * Implementations determine how base rates, adjustments, and
 * totals are computed.
 *
 * This is an extension point for future pricing models:
 * - StandardPricing: Base rate × nights + fees
 * - SeasonalPricing: Rates vary by date range
 * - DemandBasedPricing: Rates adjust based on occupancy
 * - MLPricing: Machine learning-driven dynamic pricing
 *
 * The strategy pattern allows adding new pricing models
 * without modifying existing code.
 */

import type { MoneyAmount } from '../value-objects/MoneyAmount'

/**
 * Context for pricing calculation
 */
export interface PricingContext {
  propertyId: string
  siteId: string
  checkInDate: Date
  checkOutDate: Date
  occupancy: {
    adults: number
    children: number
    pets: number
    vehicles: number
  }
  // Optional: payment intent affects pricing (Booking.com model)
  paymentIntent?: PaymentIntent
  // Optional: guest info for loyalty pricing
  guestId?: string
  // Optional: booking source for channel-based pricing
  source?: string
}

/**
 * Payment intent - how the guest intends to pay
 * Used for payment-based pricing tiers
 */
export type PaymentIntent =
  | 'full_upfront'      // Pay 100% now (may get discount)
  | 'deposit'           // Pay partial now, rest at check-in
  | 'pay_at_property'   // Pay nothing now, all at check-in

/**
 * Individual line item in price breakdown
 */
export interface PriceLineItem {
  id: string
  type: 'base_rate' | 'fee' | 'tax' | 'discount' | 'adjustment'
  description: string
  amount: MoneyAmount
  quantity?: number
  unitPrice?: MoneyAmount
  isTaxable: boolean
  metadata?: Record<string, unknown>
}

/**
 * Complete pricing result
 */
export interface PricingResult {
  // Core amounts
  subtotal: MoneyAmount          // Before fees and taxes
  feesTotal: MoneyAmount         // All fees combined
  discountsTotal: MoneyAmount    // All discounts combined
  taxesTotal: MoneyAmount        // All taxes combined
  total: MoneyAmount             // Final amount

  // Detailed breakdown
  lineItems: PriceLineItem[]

  // Payment schedule (for deposit scenarios)
  paymentSchedule: {
    dueNow: MoneyAmount
    dueAtCheckIn: MoneyAmount
    dueLater?: MoneyAmount       // For installment plans
  }

  // Rate information
  rateApplied: {
    type: 'standard' | 'weekend' | 'weekly' | 'monthly' | 'seasonal' | 'dynamic'
    name: string
    baseNightlyRate: MoneyAmount
  }

  // Metadata for auditing/display
  calculatedAt: Date
  strategyUsed: string
  warnings?: string[]
}

/**
 * Pricing strategy interface
 *
 * Implementations should be stateless. Configuration
 * comes from the context or is injected at construction.
 */
export interface IPricingStrategy {
  /**
   * Unique identifier for this strategy type
   */
  readonly strategyType: string

  /**
   * Calculate the price for a reservation
   *
   * @param context - All information needed for pricing
   * @returns Complete pricing breakdown
   */
  calculate(context: PricingContext): Promise<PricingResult>

  /**
   * Check if this strategy supports the given context
   * Used by strategy providers to select appropriate strategy
   */
  supports(context: PricingContext): boolean
}

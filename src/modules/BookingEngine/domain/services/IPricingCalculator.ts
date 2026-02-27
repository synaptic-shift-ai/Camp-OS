/**
 * Pricing Calculator Interface
 *
 * Domain service for calculating reservation pricing.
 * This interface defines the contract for pricing logic
 * that can be implemented with different strategies.
 *
 * Note: Complex pricing (seasonal rates, reservation types, dynamic pricing)
 * currently lives in lib/booking/pricing.ts and will be migrated
 * to this service during API consolidation (Phase 4).
 */

import type { DateRange } from '../value-objects/DateRange'
import type { OccupancyInfo } from '../value-objects/OccupancyInfo'

/**
 * Line item in a price breakdown
 */
export interface PriceLineItem {
  /** Description of the charge */
  description: string
  /** Amount in cents */
  amount: number
  /** Quantity (e.g., number of nights) */
  quantity: number
  /** Unit price in cents */
  unitPrice: number
  /** Category for grouping */
  category: 'base' | 'fee' | 'tax' | 'discount' | 'adjustment'
}

/**
 * Complete pricing breakdown for a reservation
 */
export interface PricingBreakdown {
  /** Individual line items */
  lineItems: PriceLineItem[]
  /** Subtotal before tax (in cents) */
  subtotal: number
  /** Tax amount (in cents) */
  taxAmount: number
  /** Total amount including tax (in cents) */
  total: number
  /** Currency code */
  currency: string
}

/**
 * Input for pricing calculation
 */
export interface PricingInput {
  /** Property ID (for property-specific rates) */
  propertyId: string
  /** Site ID (for site-specific rates) */
  siteId: string
  /** Date range for the stay */
  dateRange: DateRange
  /** Occupancy information */
  occupancy: OccupancyInfo
  /** Reservation type (affects pricing strategy) */
  reservationType?: 'nightly' | 'weekly' | 'monthly' | 'seasonal'
  /** Discount code if any */
  discountCode?: string
}

/**
 * Site pricing configuration
 */
export interface SitePricingConfig {
  /** Base price per night in cents */
  basePricePerNight: number
  /** Weekend price per night in cents (optional) */
  weekendPricePerNight?: number
  /** Weekly rate in cents (for weekly reservations) */
  weeklyRate?: number
  /** Monthly rate in cents (for monthly reservations) */
  monthlyRate?: number
  /** Extra person fee in cents */
  extraPersonFee?: number
  /** Maximum guests before extra person fee applies */
  maxGuestsIncluded?: number
  /** Pet fee per stay in cents */
  petFee?: number
  /** Cleaning fee in cents */
  cleaningFee?: number
}

/**
 * Options for pricing calculation
 */
export interface PricingOptions {
  /** Whether to include taxes */
  includeTax?: boolean
  /** Tax rate (e.g., 0.08 for 8%) */
  taxRate?: number
  /** Whether to apply discounts */
  applyDiscounts?: boolean
}

/**
 * Pricing Calculator Interface
 *
 * Provides methods for calculating reservation pricing.
 * Implementations may vary based on pricing strategies or business rules.
 */
export interface IPricingCalculator {
  /**
   * Calculate pricing for a reservation
   *
   * @param input - Pricing input including dates, site, occupancy
   * @param options - Additional calculation options
   * @returns Complete pricing breakdown
   */
  calculatePrice(
    input: PricingInput,
    options?: PricingOptions
  ): Promise<PricingBreakdown>

  /**
   * Calculate pricing using provided site config (no database lookup)
   * Useful when site data is already available
   *
   * @param siteConfig - Site pricing configuration
   * @param dateRange - Date range for the stay
   * @param occupancy - Occupancy information
   * @param options - Additional calculation options
   * @returns Complete pricing breakdown
   */
  calculatePriceFromConfig(
    siteConfig: SitePricingConfig,
    dateRange: DateRange,
    occupancy: OccupancyInfo,
    options?: PricingOptions
  ): PricingBreakdown

  /**
   * Get the base nightly rate for a site
   *
   * @param siteId - Site ID
   * @returns Base price per night in cents
   */
  getBaseNightlyRate(siteId: string): Promise<number>
}

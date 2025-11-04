/**
 * Property & Site Configuration Types
 *
 * Type definitions for the flexible configuration system that allows
 * property owners to customize pricing, deposits, booking rules, and fees
 * at both property and site levels using a macro/micro override pattern.
 *
 * @module lib/config/types
 */

import type { Database } from '@/src/contracts/db'

// =====================================================
// Base Types
// =====================================================

export type DayOfWeek =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'

export type BookingType = 'nightly' | 'weekly' | 'monthly' | 'seasonal' | 'long_term'

export type DepositType = 'percentage' | 'flat_amount' | 'first_night'

export type ServiceFeeType = 'none' | 'percentage' | 'flat' | 'per_night'

// =====================================================
// Deposit Configuration
// =====================================================

/**
 * Deposit Configuration
 *
 * Controls when and how deposits are required for bookings.
 * Can be set at property level (default) or overridden per site.
 *
 * @example
 * {
 *   require_deposit: true,
 *   deposit_type: "percentage",
 *   deposit_percentage: 25,
 *   applies_to_booking_types: ["nightly", "weekly"],
 *   exempt_if_paid_in_full: true
 * }
 */
export interface DepositConfig {
  /** Enable/disable deposit requirement */
  require_deposit: boolean

  /** Type of deposit calculation */
  deposit_type: DepositType

  /**
   * Percentage of total amount (0-100) when deposit_type is "percentage"
   * @example 25 = 25% deposit required
   */
  deposit_percentage?: number

  /**
   * Flat deposit amount in cents when deposit_type is "flat_amount"
   * @example 5000 = $50.00 deposit
   */
  deposit_amount_cents?: number

  /**
   * Which booking types require a deposit
   * Empty array means no bookings require deposit
   */
  applies_to_booking_types: BookingType[]

  /**
   * Skip deposit requirement if guest pays full amount upfront
   * @default true
   */
  exempt_if_paid_in_full: boolean

  /**
   * Days before check-in when full payment is required (null = no requirement)
   * @example 7 = Full payment required 7 days before arrival
   */
  full_payment_required_days_before?: number | null
}

// =====================================================
// Pricing Configuration
// =====================================================

/**
 * Pricing Configuration
 *
 * Controls taxes, service fees, cleaning fees, and other charges.
 * Set at property level with optional per-site overrides.
 *
 * @example
 * {
 *   tax_rate: 0.085,  // 8.5% tax
 *   tax_name: "Sales Tax",
 *   service_fee_type: "per_night",
 *   service_fee_amount_cents: 500,  // $5/night
 *   default_cleaning_fee_cents: 2500  // $25 cleaning fee
 * }
 */
export interface PricingConfig {
  /**
   * Tax rate as decimal (e.g., 0.085 for 8.5%)
   * @default 0.0
   */
  tax_rate: number

  /**
   * Display name for tax line item
   * @default "Tax"
   * @example "Sales Tax", "Occupancy Tax", "VAT"
   */
  tax_name: string

  /** Type of service fee to apply */
  service_fee_type: ServiceFeeType

  /**
   * Service fee as percentage when type is "percentage"
   * @example 5.0 = 5% service fee
   */
  service_fee_percentage?: number

  /**
   * Service fee amount in cents when type is "flat" or "per_night"
   * @example 500 = $5.00 service fee
   */
  service_fee_amount_cents?: number | null

  /**
   * Default cleaning fee in cents (can be overridden per site)
   * @example 2500 = $25.00 cleaning fee
   */
  default_cleaning_fee_cents?: number | null

  /** Enable extra guest fees beyond base occupancy */
  extra_guest_fee_enabled: boolean

  /**
   * Number of guests included in base price
   * @example 2 = Base price includes 2 guests, 3rd+ guest incurs extra fee
   */
  extra_guest_threshold: number

  /**
   * Fee per additional guest per night in cents
   * @example 1000 = $10.00 per extra guest per night
   */
  extra_guest_fee_cents: number

  /**
   * Default pet fee in cents (can be overridden per site)
   * @example 2000 = $20.00 pet fee
   */
  pet_fee_cents: number
}

// =====================================================
// Booking Rules Configuration
// =====================================================

/**
 * Booking Rules Configuration
 *
 * Controls minimum stays, booking windows, check-in/out restrictions,
 * and other operational rules. Set at property level with optional
 * per-site overrides.
 *
 * @example
 * {
 *   min_stay_nights: 2,
 *   max_stay_nights: 14,
 *   booking_window_days: 365,
 *   advance_notice_days: 1,
 *   allowed_checkin_days: ["friday", "saturday"],
 *   blackout_dates: ["2025-07-04", "2025-12-25"]
 * }
 */
export interface BookingRulesConfig {
  /**
   * Minimum nights required for booking
   * @default 1
   */
  min_stay_nights: number

  /**
   * Maximum nights allowed for booking (null = unlimited)
   * @default null
   */
  max_stay_nights: number | null

  /**
   * How many days in advance bookings are accepted
   * @default 365
   * @example 365 = Can book up to 1 year in advance
   */
  booking_window_days: number

  /**
   * Minimum days before check-in to book (0 = same day allowed)
   * @default 0
   */
  advance_notice_days: number

  /**
   * Days of week when check-in is allowed
   * @default All days
   */
  allowed_checkin_days: DayOfWeek[]

  /**
   * Days of week when check-out is allowed
   * @default All days
   */
  allowed_checkout_days: DayOfWeek[]

  /**
   * Dates when no check-in is allowed (YYYY-MM-DD format)
   * @example ["2025-07-04", "2025-12-25"]
   */
  blackout_dates: string[]

  /**
   * Allow bookings for today
   * @default true
   */
  same_day_booking_enabled: boolean

  /**
   * Allow instant booking without manual approval
   * @default true
   */
  instant_booking_enabled: boolean
}

// =====================================================
// Rate Discounts Configuration
// =====================================================

/**
 * Rate Discounts Configuration
 *
 * Controls automatic discounts for extended stays (weekly, monthly).
 * Set at property level; individual sites can override with custom rates.
 *
 * @example
 * {
 *   weekly_discount_enabled: true,
 *   weekly_discount_percentage: 10,  // 10% off
 *   weekly_minimum_nights: 7,
 *   monthly_discount_enabled: true,
 *   monthly_discount_percentage: 25,  // 25% off
 *   monthly_minimum_nights: 28
 * }
 */
export interface RateDiscountsConfig {
  /** Enable weekly rate discount */
  weekly_discount_enabled: boolean

  /**
   * Percentage discount for weekly stays (0-100)
   * @example 10 = 10% off for weekly stays
   */
  weekly_discount_percentage: number

  /**
   * Minimum nights to qualify for weekly rate
   * @default 7
   */
  weekly_minimum_nights: number

  /** Enable monthly rate discount */
  monthly_discount_enabled: boolean

  /**
   * Percentage discount for monthly stays (0-100)
   * @example 25 = 25% off for monthly stays
   */
  monthly_discount_percentage: number

  /**
   * Minimum nights to qualify for monthly rate
   * @default 28
   */
  monthly_minimum_nights: number
}

// =====================================================
// Seasonal Pricing
// =====================================================

/**
 * Seasonal Pricing Template
 *
 * Reusable template for seasonal pricing that can be applied to
 * multiple sites. Property owners create templates like "Summer Peak"
 * or "Winter Discount" and bulk apply to sites.
 */
export interface SeasonalPricingTemplate {
  id: string
  property_id: string

  /** Template name (e.g., "Summer Peak Season", "Winter Discount") */
  name: string

  /** Optional description */
  description?: string | null

  /** Season start date (YYYY-MM-DD) */
  start_date: string

  /** Season end date (YYYY-MM-DD) */
  end_date: string

  /**
   * Seasonal price in cents
   * @example 8500 = $85.00 per night during season
   */
  price_cents: number

  /**
   * If true, price only applies to Friday/Saturday nights
   * If false, applies to all nights in date range
   * @default false
   */
  applies_to_weekends: boolean

  /**
   * If true, template recurs annually using month/day from dates
   * @default false
   * @example Summer template (06-01 to 08-31) applies every year
   */
  recurring_annually: boolean

  created_at: string
  updated_at: string
  created_by?: string | null
}

/**
 * Site Seasonal Template Application
 *
 * Tracks which templates are applied to which sites,
 * allowing per-site price overrides of the template.
 */
export interface SiteSeasonalTemplateApplication {
  id: string
  site_id: string
  template_id: string

  /**
   * Override the template price for this specific site
   * @example Template is $85/night, but premium cabin overrides to $95/night
   */
  price_override_cents?: number | null

  applied_at: string
  applied_by?: string | null
}

/**
 * Seasonal Pricing Entry (per-site seasonal_pricing JSONB)
 *
 * Direct seasonal pricing on individual sites (not from templates).
 * Stored in sites.seasonal_pricing JSONB column.
 */
export interface SeasonalPricingEntry {
  /** Season identifier (e.g., "summer", "winter", "holiday") */
  season: string

  /** Season start date (YYYY-MM-DD) */
  start_date: string

  /** Season end date (YYYY-MM-DD) */
  end_date: string

  /**
   * Seasonal price in cents
   * @example 8500 = $85.00 per night during season
   */
  price_cents: number

  /**
   * If true, price only applies to Friday/Saturday nights
   * @default false
   */
  applies_to_weekends: boolean
}

// =====================================================
// Effective Configuration (Resolved Property + Site)
// =====================================================

/**
 * Effective Deposit Configuration
 *
 * Result of merging property deposit_config with site deposit_override.
 * This is what should be used for calculations.
 */
export type EffectiveDepositConfig = DepositConfig

/**
 * Effective Pricing Configuration
 *
 * Result of merging property pricing_config with site pricing_override.
 * This is what should be used for price calculations.
 */
export type EffectivePricingConfig = PricingConfig

/**
 * Effective Booking Rules Configuration
 *
 * Result of merging property booking_rules_config with site booking_rules_override.
 * This is what should be used for validation.
 */
export type EffectiveBookingRulesConfig = BookingRulesConfig

// =====================================================
// Database Types (extending Supabase generated types)
// =====================================================

/**
 * Property with Configuration
 *
 * Extended property type including all configuration fields.
 */
export interface PropertyWithConfig {
  id: string
  name: string
  owner_id: string
  company_id?: string | null

  // Configuration fields
  deposit_config: DepositConfig
  pricing_config: PricingConfig
  booking_rules_config: BookingRulesConfig
  rate_discounts_config: RateDiscountsConfig

  // Existing operational fields
  check_in_time: string
  check_out_time: string
  timezone: string
  minimum_stay_nights: number

  // Other property fields...
  [key: string]: any
}

/**
 * Site with Configuration
 *
 * Extended site type including override configuration fields.
 */
export interface SiteWithConfig {
  id: string
  property_id: string
  name: string
  site_number?: string | null
  site_type: string

  // Base pricing
  base_price: number
  weekend_price_cents?: number | null
  seasonal_pricing: SeasonalPricingEntry[]

  // Extended stay rates
  weekly_rate_cents?: number | null
  monthly_rate_cents?: number | null

  // Configuration overrides
  deposit_override?: DepositConfig | null
  pricing_override?: Partial<PricingConfig> | null
  booking_rules_override?: Partial<BookingRulesConfig> | null

  // Booking rules (legacy, to be migrated to booking_rules_override)
  availability_rules?: {
    min_stay?: number
    max_stay?: number
    booking_window_days?: number
    advance_booking_days?: number
    blackout_dates?: string[]
    check_in_days?: string[]
    check_out_days?: string[]
  } | null

  // Other site fields...
  [key: string]: any
}

// =====================================================
// Configuration Resolution Helpers
// =====================================================

/**
 * Configuration Resolution Result
 *
 * Contains both the effective configuration and metadata about
 * where each setting came from (property default vs site override).
 */
export interface ConfigurationResolution<T> {
  /** The effective configuration to use */
  config: T

  /** True if site has overridden property defaults */
  is_overridden: boolean

  /** Which fields are overridden (if applicable) */
  overridden_fields?: string[]
}

// =====================================================
// Validation Results
// =====================================================

/**
 * Booking Rule Validation Result
 *
 * Result of validating a booking request against effective booking rules.
 */
export interface BookingRuleValidationResult {
  /** True if booking passes all rules */
  is_valid: boolean

  /** Array of validation errors (empty if valid) */
  errors: BookingRuleValidationError[]

  /** The effective rules that were checked */
  rules_checked: EffectiveBookingRulesConfig
}

/**
 * Booking Rule Validation Error
 *
 * Specific rule violation with user-friendly message.
 */
export interface BookingRuleValidationError {
  /** Error code for programmatic handling */
  code: string

  /** User-friendly error message */
  message: string

  /** Related field (e.g., "check_in_date", "num_nights") */
  field?: string

  /** The rule that was violated */
  rule_violated: string

  /** The rule's value that caused the error */
  rule_value?: any
}

// =====================================================
// Helper Types for UI
// =====================================================

/**
 * Configuration Change
 *
 * Represents a change to a configuration setting, used for
 * tracking and previewing changes in the admin UI.
 */
export interface ConfigurationChange {
  /** Which configuration section */
  section: 'deposit' | 'pricing' | 'booking_rules' | 'rate_discounts'

  /** Field path (e.g., "deposit_percentage", "pricing_config.tax_rate") */
  field: string

  /** Previous value */
  old_value: any

  /** New value */
  new_value: any

  /** Human-readable description of the change */
  description: string
}

/**
 * Bulk Configuration Application
 *
 * Request to apply configuration changes to multiple sites at once.
 */
export interface BulkConfigurationApplication {
  /** Site IDs to apply configuration to */
  site_ids: string[]

  /** Configuration changes to apply */
  changes: {
    deposit_override?: Partial<DepositConfig>
    pricing_override?: Partial<PricingConfig>
    booking_rules_override?: Partial<BookingRulesConfig>
  }

  /** Whether to merge with existing overrides or replace */
  merge_mode: 'merge' | 'replace'
}

// =====================================================
// Export Defaults
// =====================================================

/**
 * Default Deposit Configuration
 */
export const DEFAULT_DEPOSIT_CONFIG: DepositConfig = {
  require_deposit: false,
  deposit_type: 'percentage',
  deposit_percentage: 25,
  deposit_amount_cents: undefined,
  applies_to_booking_types: ['nightly', 'weekly', 'monthly', 'seasonal', 'long_term'],
  exempt_if_paid_in_full: true,
  full_payment_required_days_before: null,
}

/**
 * Default Pricing Configuration
 */
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  tax_rate: 0.0,
  tax_name: 'Tax',
  service_fee_type: 'none',
  service_fee_percentage: 0,
  service_fee_amount_cents: null,
  default_cleaning_fee_cents: null,
  extra_guest_fee_enabled: false,
  extra_guest_threshold: 2,
  extra_guest_fee_cents: 0,
  pet_fee_cents: 2000, // $20.00 default
}

/**
 * Default Booking Rules Configuration
 */
export const DEFAULT_BOOKING_RULES_CONFIG: BookingRulesConfig = {
  min_stay_nights: 1,
  max_stay_nights: null,
  booking_window_days: 365,
  advance_notice_days: 0,
  allowed_checkin_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  allowed_checkout_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  blackout_dates: [],
  same_day_booking_enabled: true,
  instant_booking_enabled: true,
}

/**
 * Default Rate Discounts Configuration
 */
export const DEFAULT_RATE_DISCOUNTS_CONFIG: RateDiscountsConfig = {
  weekly_discount_enabled: false,
  weekly_discount_percentage: 0,
  weekly_minimum_nights: 7,
  monthly_discount_enabled: false,
  monthly_discount_percentage: 0,
  monthly_minimum_nights: 28,
}

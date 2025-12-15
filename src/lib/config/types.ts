/**
 * Property & Site Configuration Types
 *
 * Type definitions for the flexible configuration system that allows
 * property owners to customize pricing, deposits, booking rules, and fees
 * at both property and site levels using a macro/micro override pattern.
 *
 * @module lib/config/types
 */

import type { Database } from '@/contracts/db'

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
// User-Defined Fee Types
// =====================================================

/**
 * Fee calculation types for user-defined fees
 */
export type UserDefinedFeeType =
  | 'flat_amount'             // One-time flat fee (e.g., $25 cleaning)
  | 'percentage_of_subtotal'  // % of base nightly subtotal before fees
  | 'percentage_of_total'     // % of total including other fees
  | 'per_night'               // Fee per night (e.g., $10/night resort fee)
  | 'per_guest'               // Fee per guest total (e.g., $5/guest activity fee)
  | 'per_guest_per_night'     // Fee per guest per night (e.g., $10/guest/night)

/**
 * Discount calculation types for user-defined discounts
 */
export type UserDefinedDiscountType =
  | 'flat_amount'             // Fixed dollar off (e.g., $50 off)
  | 'percentage_of_subtotal'  // % off subtotal before fees
  | 'percentage_of_total'     // % off total including fees

/**
 * Trigger types for automatic fee application (Additional Charges)
 */
export type FeeTriggerType =
  | 'always'                  // Auto-apply to every reservation
  | 'manual'                  // Staff applies manually (one-time charges)
  | 'min_nights'              // Auto-apply when stay >= X nights
  | 'min_guests'              // Auto-apply when guests >= X
  | 'has_pets'                // Auto-apply when reservation includes pets
  | 'date_range'              // Auto-apply during specific date range

/**
 * Trigger types for automatic discount application
 */
export type DiscountTriggerType =
  | 'manual'                  // Staff applies manually or via coupon code
  | 'min_nights'              // Auto-apply when stay >= X nights
  | 'min_guests'              // Auto-apply when guests >= X
  | 'date_range'              // Auto-apply during specific date range

/**
 * User-Defined Fee Entry (Additional Charge)
 *
 * Represents a single fee that can be configured by property owners.
 * Replaces hard-coded fees (cleaning, pet, service, extra guest).
 *
 * @example
 * {
 *   id: "550e8400-e29b-41d4-a716-446655440000",
 *   title: "Cleaning Fee",
 *   fee_type: "flat_amount",
 *   value_cents: 2500,  // $25.00
 *   trigger_type: "always",  // Auto-apply to all reservations
 *   is_taxable: true,
 *   display_order: 1,
 *   enabled: true
 * }
 */
export interface UserDefinedFee {
  /** Unique identifier (UUID) */
  id: string

  /** Display name for the fee (e.g., "Cleaning Fee", "Resort Fee") */
  title: string

  /** Optional description/tooltip text */
  description?: string

  /** How the fee is calculated */
  fee_type: UserDefinedFeeType

  /**
   * Value in cents for flat/per-night/per-guest types
   * @example 2500 = $25.00
   */
  value_cents?: number

  /**
   * Percentage value for percentage types (0-100)
   * @example 5 = 5%
   */
  value_percentage?: number

  /** Whether this fee is subject to tax */
  is_taxable: boolean

  /**
   * When the fee is applied
   * @default 'always'
   */
  trigger_type: FeeTriggerType

  /**
   * Conditions for automatic triggers
   * Only used when trigger_type is not 'always' or 'manual'
   */
  trigger_conditions?: {
    /** Minimum nights for min_nights trigger */
    min_nights?: number
    /** Minimum guests for min_guests trigger */
    min_guests?: number
    /** Start date for date_range trigger (YYYY-MM-DD) */
    start_date?: string
    /** End date for date_range trigger (YYYY-MM-DD) */
    end_date?: string
  }

  /** Order in which fees are displayed and calculated */
  display_order: number

  /** Whether the fee is currently active */
  enabled: boolean

  /** When the fee was created (ISO string) */
  created_at: string
}

/**
 * User-Defined Discount Entry
 *
 * Represents a single discount that can be configured by property owners.
 * Replaces hard-coded weekly/monthly discounts with flexible conditions.
 *
 * @example
 * {
 *   id: "550e8400-e29b-41d4-a716-446655440001",
 *   title: "Weekly Stay Discount",
 *   discount_type: "percentage_of_subtotal",
 *   value_percentage: 10,  // 10% off
 *   trigger_type: "min_nights",
 *   trigger_conditions: { min_nights: 7 },
 *   enabled: true
 * }
 */
export interface UserDefinedDiscount {
  /** Unique identifier (UUID) */
  id: string

  /** Display name for the discount (e.g., "Weekly Stay Discount") */
  title: string

  /** Optional description/tooltip text */
  description?: string

  /** How the discount is calculated */
  discount_type: UserDefinedDiscountType

  /**
   * Value in cents for flat_amount type
   * @example 5000 = $50.00 off
   */
  value_cents?: number

  /**
   * Percentage value for percentage types (0-100)
   * @example 10 = 10% off
   */
  value_percentage?: number

  /** When the discount is applied */
  trigger_type: DiscountTriggerType

  /**
   * Conditions for automatic triggers
   * Only used when trigger_type is not 'manual'
   */
  trigger_conditions?: {
    /** Minimum nights for min_nights trigger */
    min_nights?: number
    /** Minimum guests for min_guests trigger */
    min_guests?: number
    /** Start date for date_range trigger (YYYY-MM-DD) */
    start_date?: string
    /** End date for date_range trigger (YYYY-MM-DD) */
    end_date?: string
  }

  /**
   * Optional maximum discount amount in cents
   * Caps percentage discounts to prevent excessive discounts
   * @example 10000 = max $100 discount
   */
  max_discount_cents?: number

  /** Order in which discounts are displayed */
  display_order: number

  /** Whether the discount is currently active */
  enabled: boolean

  /** When the discount was created (ISO string) */
  created_at: string
}

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

  /**
   * User-defined fees array
   * Replaces legacy service_fee, cleaning_fee, pet_fee, extra_guest_fee
   */
  user_defined_fees: UserDefinedFee[]

  // =====================================================
  // LEGACY FIELDS (kept for backward compatibility during migration)
  // These will be removed after data migration is complete
  // =====================================================

  /**
   * @deprecated Use user_defined_fees instead
   * Type of service fee to apply
   */
  service_fee_type?: ServiceFeeType

  /**
   * @deprecated Use user_defined_fees instead
   * Service fee as percentage when type is "percentage"
   * @example 5.0 = 5% service fee
   */
  service_fee_percentage?: number

  /**
   * @deprecated Use user_defined_fees instead
   * Service fee amount in cents when type is "flat" or "per_night"
   * @example 500 = $5.00 service fee
   */
  service_fee_amount_cents?: number | null

  /**
   * @deprecated Use user_defined_fees instead
   * Default cleaning fee in cents (can be overridden per site)
   * @example 2500 = $25.00 cleaning fee
   */
  default_cleaning_fee_cents?: number | null

  /**
   * @deprecated Use user_defined_fees instead
   * Enable extra guest fees beyond base occupancy
   */
  extra_guest_fee_enabled?: boolean

  /**
   * @deprecated Use user_defined_fees instead
   * Number of guests included in base price
   * @example 2 = Base price includes 2 guests, 3rd+ guest incurs extra fee
   */
  extra_guest_threshold?: number

  /**
   * @deprecated Use user_defined_fees instead
   * Fee per additional guest per night in cents
   * @example 1000 = $10.00 per extra guest per night
   */
  extra_guest_fee_cents?: number

  /**
   * @deprecated Use user_defined_fees instead
   * Default pet fee in cents (can be overridden per site)
   * @example 2000 = $20.00 pet fee
   */
  pet_fee_cents?: number
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
  /**
   * User-defined discounts array
   * Replaces legacy weekly_discount and monthly_discount
   */
  user_defined_discounts: UserDefinedDiscount[]

  // =====================================================
  // LEGACY FIELDS (kept for backward compatibility during migration)
  // These will be removed after data migration is complete
  // =====================================================

  /**
   * @deprecated Use user_defined_discounts instead
   * Enable weekly rate discount
   */
  weekly_discount_enabled?: boolean

  /**
   * @deprecated Use user_defined_discounts instead
   * Percentage discount for weekly stays (0-100)
   * @example 10 = 10% off for weekly stays
   */
  weekly_discount_percentage?: number

  /**
   * @deprecated Use user_defined_discounts instead
   * Minimum nights to qualify for weekly rate
   * @default 7
   */
  weekly_minimum_nights?: number

  /**
   * @deprecated Use user_defined_discounts instead
   * Enable monthly rate discount
   */
  monthly_discount_enabled?: boolean

  /**
   * @deprecated Use user_defined_discounts instead
   * Percentage discount for monthly stays (0-100)
   * @example 25 = 25% off for monthly stays
   */
  monthly_discount_percentage?: number

  /**
   * @deprecated Use user_defined_discounts instead
   * Minimum nights to qualify for monthly rate
   * @default 28
   */
  monthly_minimum_nights?: number
}

// =====================================================
// Reservation Type Configuration
// =====================================================

/**
 * Reservation Type Configuration
 *
 * Configuration for a single reservation type (nightly, weekly, monthly, seasonal).
 * Defines whether the type is enabled, its night range requirements, and the rate.
 *
 * @example
 * {
 *   enabled: true,
 *   min_nights: 7,
 *   max_nights: 27,
 *   rate_cents: 7500  // $75/night for weekly stays
 * }
 */
export interface ReservationTypeConfig {
  /** Whether this reservation type is enabled */
  enabled: boolean

  /**
   * Minimum nights required for this rate type to apply
   * @example 7 = At least 7 nights for weekly rate
   */
  min_nights: number

  /**
   * Maximum nights for this rate type (null = unlimited)
   * @example 27 = Up to 27 nights for weekly rate (28+ becomes monthly)
   */
  max_nights: number | null

  /**
   * Per-night rate in cents for this reservation type (null = inherit from site base_price)
   * @example 7500 = $75.00 per night
   */
  rate_cents?: number | null
}

/**
 * Seasonal Reservation Type Configuration
 *
 * Extended configuration for seasonal reservations, which use
 * flat rates instead of per-night pricing.
 *
 * Note: For seasonal type, `rate_cents` represents a flat rate for the
 * entire season, not a per-night rate. Actual seasonal rates are typically
 * managed via SeasonalPeriod records which can have site-specific overrides.
 */
export interface SeasonalReservationTypeConfig extends ReservationTypeConfig {
  /** Seasonal reservations use flat rate for entire season */
  flat_rate: true
}

/**
 * Property Reservation Types Configuration
 *
 * Complete configuration for all reservation types at the property level.
 * Controls which types are available and their night thresholds.
 *
 * @example
 * {
 *   nightly: { enabled: true, min_nights: 1, max_nights: 6 },
 *   weekly: { enabled: true, min_nights: 7, max_nights: 27 },
 *   monthly: { enabled: true, min_nights: 28, max_nights: null },
 *   seasonal: { enabled: false, min_nights: 1, max_nights: null, flat_rate: true }
 * }
 */
export interface PropertyReservationTypesConfig {
  nightly: ReservationTypeConfig
  weekly: ReservationTypeConfig
  monthly: ReservationTypeConfig
  seasonal: SeasonalReservationTypeConfig
}

/**
 * Seasonal Period
 *
 * Defines a named season at the property level with date ranges
 * and a flat rate. Sites can override the rate per season.
 *
 * @example
 * {
 *   id: "uuid",
 *   property_id: "uuid",
 *   name: "Summer Season",
 *   start_month: 6, start_day: 1,
 *   end_month: 8, end_day: 31,
 *   base_rate_cents: 350000,  // $3,500 flat rate for season
 *   recurring: true
 * }
 */
export interface SeasonalPeriod {
  id: string
  property_id: string

  /** Display name for the season (e.g., "Summer Season") */
  name: string

  /** Start month (1-12) */
  start_month: number

  /** Start day of month (1-31) */
  start_day: number

  /** End month (1-12) */
  end_month: number

  /** End day of month (1-31) */
  end_day: number

  /**
   * Flat rate for the entire season in cents (not per-night)
   * @example 350000 = $3,500 for the entire season
   */
  base_rate_cents: number

  /** If true, season repeats every year */
  recurring: boolean

  created_at?: string
  updated_at?: string
}

/**
 * Site Seasonal Rate
 *
 * Per-site rate override for a seasonal period.
 * If not set for a site, it inherits the season's base_rate_cents.
 *
 * @example
 * {
 *   id: "uuid",
 *   site_id: "uuid",
 *   seasonal_period_id: "uuid",
 *   rate_cents: 400000  // $4,000 for premium site
 * }
 */
export interface SiteSeasonalRate {
  id: string
  site_id: string
  seasonal_period_id: string

  /**
   * Site-specific flat rate for this season in cents
   * @example 400000 = $4,000 for the season (premium site)
   */
  rate_cents: number

  created_at?: string
}

/**
 * Reservation Type Detection Result
 *
 * Result of auto-detecting the best reservation type for a booking.
 */
export interface ReservationTypeDetectionResult {
  /** The detected/recommended reservation type */
  type: BookingType

  /** Human-readable explanation for the detection */
  reason: string

  /** If seasonal, the matching seasonal period */
  seasonal_period?: SeasonalPeriod
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

  // Reservation type overrides
  /** Override property's enabled reservation types for this site */
  enabled_reservation_types_override?: BookingType[] | null
  /** Site's default reservation type (overrides property default) */
  default_reservation_type?: BookingType | null
  /** Per-type rate overrides for this site (cents) */
  reservation_type_rates_override?: Partial<Record<BookingType, number>> | null

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
  user_defined_fees: [],
  // Legacy defaults (for backward compatibility)
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
  user_defined_discounts: [],
  // Legacy defaults (for backward compatibility)
  weekly_discount_enabled: false,
  weekly_discount_percentage: 0,
  weekly_minimum_nights: 7,
  monthly_discount_enabled: false,
  monthly_discount_percentage: 0,
  monthly_minimum_nights: 28,
}

/**
 * Default Reservation Types Configuration
 */
export const DEFAULT_RESERVATION_TYPES_CONFIG: PropertyReservationTypesConfig = {
  nightly: {
    enabled: true,
    min_nights: 1,
    max_nights: 6,
    rate_cents: null,
  },
  weekly: {
    enabled: true,
    min_nights: 7,
    max_nights: 27,
    rate_cents: null,
  },
  monthly: {
    enabled: true,
    min_nights: 28,
    max_nights: null,
    rate_cents: null,
  },
  seasonal: {
    enabled: false,
    min_nights: 1,
    max_nights: null,
    flat_rate: true,
    rate_cents: null,
  },
}

/**
 * Default Enabled Reservation Types
 */
export const DEFAULT_ENABLED_RESERVATION_TYPES: BookingType[] = ['nightly', 'weekly', 'monthly']

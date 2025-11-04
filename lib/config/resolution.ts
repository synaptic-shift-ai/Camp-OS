/**
 * Configuration Resolution Helpers
 *
 * Functions for resolving effective configuration by merging property-level
 * defaults with site-level overrides following the macro/micro pattern.
 *
 * @module lib/config/resolution
 */

import type {
  DepositConfig,
  PricingConfig,
  BookingRulesConfig,
  RateDiscountsConfig,
  EffectiveDepositConfig,
  EffectivePricingConfig,
  EffectiveBookingRulesConfig,
  PropertyWithConfig,
  SiteWithConfig,
  ConfigurationResolution,
} from './types'
import {
  DEFAULT_DEPOSIT_CONFIG,
  DEFAULT_PRICING_CONFIG,
  DEFAULT_BOOKING_RULES_CONFIG,
  DEFAULT_RATE_DISCOUNTS_CONFIG,
} from './types'

// =====================================================
// Deposit Configuration Resolution
// =====================================================

/**
 * Resolve effective deposit configuration for a site
 *
 * Priority order:
 * 1. Site deposit_override (if set)
 * 2. Property deposit_config
 * 3. System defaults
 *
 * @param propertyConfig - Property's deposit configuration
 * @param siteOverride - Site's deposit override (optional)
 * @returns Effective deposit configuration to use
 */
export function resolveDepositConfig(
  propertyConfig: DepositConfig | null | undefined,
  siteOverride: Partial<DepositConfig> | null | undefined
): ConfigurationResolution<EffectiveDepositConfig> {
  // Start with defaults
  let effectiveConfig: EffectiveDepositConfig = {
    ...DEFAULT_DEPOSIT_CONFIG,
  }

  // Apply property config if available
  if (propertyConfig) {
    effectiveConfig = {
      ...effectiveConfig,
      ...propertyConfig,
    }
  }

  // Apply site override if available
  const isOverridden = siteOverride !== null && siteOverride !== undefined
  if (isOverridden && siteOverride) {
    effectiveConfig = {
      ...effectiveConfig,
      ...siteOverride,
    }
  }

  return {
    config: effectiveConfig,
    is_overridden: isOverridden,
    overridden_fields: isOverridden ? Object.keys(siteOverride!) : [],
  }
}

// =====================================================
// Pricing Configuration Resolution
// =====================================================

/**
 * Resolve effective pricing configuration for a site
 *
 * Priority order:
 * 1. Site pricing_override (if set) - partial override supported
 * 2. Property pricing_config
 * 3. System defaults
 *
 * @param propertyConfig - Property's pricing configuration
 * @param siteOverride - Site's pricing override (optional, partial)
 * @returns Effective pricing configuration to use
 */
export function resolvePricingConfig(
  propertyConfig: PricingConfig | null | undefined,
  siteOverride: Partial<PricingConfig> | null | undefined
): ConfigurationResolution<EffectivePricingConfig> {
  // Start with defaults
  let effectiveConfig: EffectivePricingConfig = {
    ...DEFAULT_PRICING_CONFIG,
  }

  // Apply property config if available
  if (propertyConfig) {
    effectiveConfig = {
      ...effectiveConfig,
      ...propertyConfig,
    }
  }

  // Apply site override if available (partial override supported)
  const isOverridden = siteOverride !== null && siteOverride !== undefined
  if (isOverridden && siteOverride) {
    effectiveConfig = {
      ...effectiveConfig,
      ...siteOverride,
    }
  }

  return {
    config: effectiveConfig,
    is_overridden: isOverridden,
    overridden_fields: isOverridden ? Object.keys(siteOverride!) : [],
  }
}

// =====================================================
// Booking Rules Configuration Resolution
// =====================================================

/**
 * Resolve effective booking rules for a site
 *
 * Priority order:
 * 1. Site booking_rules_override (if set) - partial override supported
 * 2. Property booking_rules_config
 * 3. System defaults
 *
 * Also checks legacy availability_rules and migrates them
 *
 * @param propertyConfig - Property's booking rules configuration
 * @param siteOverride - Site's booking rules override (optional, partial)
 * @param legacyAvailabilityRules - Legacy site availability_rules (deprecated)
 * @returns Effective booking rules configuration to use
 */
export function resolveBookingRulesConfig(
  propertyConfig: BookingRulesConfig | null | undefined,
  siteOverride: Partial<BookingRulesConfig> | null | undefined,
  legacyAvailabilityRules?: {
    min_stay?: number
    max_stay?: number
    booking_window_days?: number
    advance_booking_days?: number
    blackout_dates?: string[]
    check_in_days?: string[]
    check_out_days?: string[]
  } | null
): ConfigurationResolution<EffectiveBookingRulesConfig> {
  // Start with defaults
  let effectiveConfig: EffectiveBookingRulesConfig = {
    ...DEFAULT_BOOKING_RULES_CONFIG,
  }

  // Apply property config if available
  if (propertyConfig) {
    effectiveConfig = {
      ...effectiveConfig,
      ...propertyConfig,
    }
  }

  // Migrate legacy availability_rules if present and no modern override
  if (legacyAvailabilityRules && !siteOverride) {
    const migrated: Partial<BookingRulesConfig> = {}

    if (legacyAvailabilityRules.min_stay !== undefined) {
      migrated.min_stay_nights = legacyAvailabilityRules.min_stay
    }
    if (legacyAvailabilityRules.max_stay !== undefined) {
      migrated.max_stay_nights = legacyAvailabilityRules.max_stay
    }
    if (legacyAvailabilityRules.booking_window_days !== undefined) {
      migrated.booking_window_days = legacyAvailabilityRules.booking_window_days
    }
    if (legacyAvailabilityRules.advance_booking_days !== undefined) {
      migrated.advance_notice_days = legacyAvailabilityRules.advance_booking_days
    }
    if (legacyAvailabilityRules.blackout_dates) {
      migrated.blackout_dates = legacyAvailabilityRules.blackout_dates
    }
    if (legacyAvailabilityRules.check_in_days) {
      migrated.allowed_checkin_days = legacyAvailabilityRules.check_in_days as any
    }
    if (legacyAvailabilityRules.check_out_days) {
      migrated.allowed_checkout_days = legacyAvailabilityRules.check_out_days as any
    }

    effectiveConfig = {
      ...effectiveConfig,
      ...migrated,
    }
  }

  // Apply site override if available (takes precedence over legacy)
  const isOverridden = siteOverride !== null && siteOverride !== undefined
  if (isOverridden && siteOverride) {
    effectiveConfig = {
      ...effectiveConfig,
      ...siteOverride,
    }
  }

  return {
    config: effectiveConfig,
    is_overridden: isOverridden,
    overridden_fields: isOverridden ? Object.keys(siteOverride!) : [],
  }
}

// =====================================================
// Rate Discounts Configuration Resolution
// =====================================================

/**
 * Resolve effective rate discounts configuration
 *
 * Rate discounts are property-level only (no site override)
 *
 * @param propertyConfig - Property's rate discounts configuration
 * @returns Effective rate discounts configuration to use
 */
export function resolveRateDiscountsConfig(
  propertyConfig: RateDiscountsConfig | null | undefined
): RateDiscountsConfig {
  if (propertyConfig) {
    return propertyConfig
  }
  return DEFAULT_RATE_DISCOUNTS_CONFIG
}

// =====================================================
// Complete Site Configuration Resolution
// =====================================================

/**
 * Resolve all effective configurations for a site
 *
 * Convenience function that resolves all configuration types at once
 *
 * @param property - Property with configuration
 * @param site - Site with optional overrides
 * @returns Object containing all effective configurations
 */
export function resolveSiteConfiguration(property: PropertyWithConfig, site: SiteWithConfig) {
  return {
    deposit: resolveDepositConfig(property.deposit_config, site.deposit_override),
    pricing: resolvePricingConfig(property.pricing_config, site.pricing_override),
    booking_rules: resolveBookingRulesConfig(
      property.booking_rules_config,
      site.booking_rules_override,
      site.availability_rules
    ),
    rate_discounts: resolveRateDiscountsConfig(property.rate_discounts_config),
  }
}

// =====================================================
// Configuration Comparison Helpers
// =====================================================

/**
 * Check if a site is using property defaults or has overrides
 *
 * @param site - Site to check
 * @returns True if site has any configuration overrides
 */
export function siteHasConfigOverrides(site: SiteWithConfig): boolean {
  return !!(
    site.deposit_override ||
    site.pricing_override ||
    site.booking_rules_override
  )
}

/**
 * Get a summary of which configurations are overridden
 *
 * @param site - Site to check
 * @returns Object indicating which config sections are overridden
 */
export function getSiteOverrideSummary(site: SiteWithConfig) {
  return {
    has_deposit_override: !!site.deposit_override,
    has_pricing_override: !!site.pricing_override,
    has_booking_rules_override: !!site.booking_rules_override,
    has_any_override: siteHasConfigOverrides(site),
  }
}

/**
 * Calculate the effective nightly rate for a site considering discounts
 *
 * Determines which rate to use based on stay duration and configured discounts
 *
 * @param site - Site with pricing information
 * @param rateDiscounts - Property's rate discounts configuration
 * @param numNights - Number of nights in the stay
 * @param isWeekend - Whether the night is a weekend
 * @returns Effective nightly rate in cents
 */
export function getEffectiveNightlyRate(
  site: SiteWithConfig,
  rateDiscounts: RateDiscountsConfig,
  numNights: number,
  isWeekend: boolean = false
): number {
  // Check if monthly rate applies (and site has custom monthly rate)
  if (
    site.monthly_rate_cents &&
    rateDiscounts.monthly_discount_enabled &&
    numNights >= rateDiscounts.monthly_minimum_nights
  ) {
    return site.monthly_rate_cents
  }

  // Check if weekly rate applies (and site has custom weekly rate)
  if (
    site.weekly_rate_cents &&
    rateDiscounts.weekly_discount_enabled &&
    numNights >= rateDiscounts.weekly_minimum_nights
  ) {
    return site.weekly_rate_cents
  }

  // Use weekend rate if applicable
  const baseRate = isWeekend && site.weekend_price_cents
    ? site.weekend_price_cents
    : site.base_price

  // Apply monthly discount percentage if no custom rate
  if (
    !site.monthly_rate_cents &&
    rateDiscounts.monthly_discount_enabled &&
    numNights >= rateDiscounts.monthly_minimum_nights &&
    rateDiscounts.monthly_discount_percentage > 0
  ) {
    const discountMultiplier = 1 - (rateDiscounts.monthly_discount_percentage / 100)
    return Math.round(baseRate * discountMultiplier)
  }

  // Apply weekly discount percentage if no custom rate
  if (
    !site.weekly_rate_cents &&
    rateDiscounts.weekly_discount_enabled &&
    numNights >= rateDiscounts.weekly_minimum_nights &&
    rateDiscounts.weekly_discount_percentage > 0
  ) {
    const discountMultiplier = 1 - (rateDiscounts.weekly_discount_percentage / 100)
    return Math.round(baseRate * discountMultiplier)
  }

  // Return base rate (or weekend rate)
  return baseRate
}

/**
 * Determine which discount tier applies to a stay
 *
 * @param rateDiscounts - Property's rate discounts configuration
 * @param numNights - Number of nights in the stay
 * @returns Discount tier info or null if no discount applies
 */
export function getApplicableDiscountTier(
  rateDiscounts: RateDiscountsConfig,
  numNights: number
): {
  tier: 'monthly' | 'weekly' | 'none'
  discount_percentage: number
  minimum_nights: number
} {
  // Check monthly first (highest tier)
  if (
    rateDiscounts.monthly_discount_enabled &&
    numNights >= rateDiscounts.monthly_minimum_nights
  ) {
    return {
      tier: 'monthly',
      discount_percentage: rateDiscounts.monthly_discount_percentage,
      minimum_nights: rateDiscounts.monthly_minimum_nights,
    }
  }

  // Check weekly second
  if (
    rateDiscounts.weekly_discount_enabled &&
    numNights >= rateDiscounts.weekly_minimum_nights
  ) {
    return {
      tier: 'weekly',
      discount_percentage: rateDiscounts.weekly_discount_percentage,
      minimum_nights: rateDiscounts.weekly_minimum_nights,
    }
  }

  // No discount applies
  return {
    tier: 'none',
    discount_percentage: 0,
    minimum_nights: 0,
  }
}

// =====================================================
// Helper for Database Function Results
// =====================================================

/**
 * Parse deposit config from database function result
 *
 * Handles the result from get_effective_deposit_config() PostgreSQL function
 *
 * @param dbResult - JSONB result from database function
 * @returns Parsed deposit configuration
 */
export function parseDepositConfigFromDB(dbResult: any): DepositConfig {
  if (!dbResult) return DEFAULT_DEPOSIT_CONFIG

  return {
    require_deposit: dbResult.require_deposit ?? false,
    deposit_type: dbResult.deposit_type ?? 'percentage',
    deposit_percentage: dbResult.deposit_percentage,
    deposit_amount_cents: dbResult.deposit_amount_cents,
    applies_to_booking_types: dbResult.applies_to_booking_types ?? [
      'nightly',
      'weekly',
      'monthly',
      'seasonal',
      'long_term',
    ],
    exempt_if_paid_in_full: dbResult.exempt_if_paid_in_full ?? true,
    full_payment_required_days_before: dbResult.full_payment_required_days_before,
  }
}

/**
 * Parse booking rules from database function result
 *
 * Handles the result from get_effective_booking_rules() PostgreSQL function
 *
 * @param dbResult - JSONB result from database function
 * @returns Parsed booking rules configuration
 */
export function parseBookingRulesFromDB(dbResult: any): BookingRulesConfig {
  if (!dbResult) return DEFAULT_BOOKING_RULES_CONFIG

  return {
    min_stay_nights: dbResult.min_stay_nights ?? 1,
    max_stay_nights: dbResult.max_stay_nights,
    booking_window_days: dbResult.booking_window_days ?? 365,
    advance_notice_days: dbResult.advance_notice_days ?? 0,
    allowed_checkin_days: dbResult.allowed_checkin_days ?? [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ],
    allowed_checkout_days: dbResult.allowed_checkout_days ?? [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ],
    blackout_dates: dbResult.blackout_dates ?? [],
    same_day_booking_enabled: dbResult.same_day_booking_enabled ?? true,
    instant_booking_enabled: dbResult.instant_booking_enabled ?? true,
  }
}

/**
 * Reservation Type Detection
 *
 * Logic for auto-detecting the best reservation type based on
 * stay length and seasonal periods.
 *
 * Risk Classification: CRITICAL (pricing logic)
 *
 * @module lib/booking/reservation-type-detection
 */

import type {
  BookingType,
  PropertyReservationTypesConfig,
  SeasonalPeriod,
  SiteSeasonalRate,
  ReservationTypeDetectionResult,
} from '@/lib/config/types'

/**
 * Detect the best reservation type based on stay length and seasonal periods.
 *
 * Priority order:
 * 1. Seasonal (if enabled and dates fall within a seasonal period)
 * 2. Monthly (if enabled and stay >= min_nights)
 * 3. Weekly (if enabled and stay >= min_nights)
 * 4. Nightly (default fallback)
 *
 * @param numNights - Number of nights for the stay
 * @param checkInDate - Check-in date (YYYY-MM-DD)
 * @param checkOutDate - Check-out date (YYYY-MM-DD)
 * @param config - Property reservation types configuration
 * @param seasonalPeriods - Array of seasonal periods defined for the property
 * @returns Detection result with type, reason, and optional seasonal period
 */
export function detectBestReservationType(
  numNights: number,
  checkInDate: string,
  checkOutDate: string,
  config: PropertyReservationTypesConfig,
  seasonalPeriods: SeasonalPeriod[]
): ReservationTypeDetectionResult {
  // Handle edge case of zero nights
  if (numNights <= 0) {
    return {
      type: 'nightly',
      reason: 'Standard nightly rate',
    }
  }

  // Check for seasonal first (highest priority if enabled)
  if (config.seasonal.enabled && seasonalPeriods.length > 0) {
    const matchingSeason = findMatchingSeasonalPeriod(
      checkInDate,
      checkOutDate,
      seasonalPeriods
    )

    if (matchingSeason) {
      return {
        type: 'seasonal',
        reason: `${matchingSeason.name} rates apply`,
        seasonal_period: matchingSeason,
      }
    }
  }

  // Check monthly (second priority - typically best discount for long stays)
  if (config.monthly.enabled && numNights >= config.monthly.min_nights) {
    return {
      type: 'monthly',
      reason: `Monthly rate for ${config.monthly.min_nights}+ nights`,
    }
  }

  // Check weekly (third priority)
  // Note: If monthly is disabled, weekly applies even for stays > weekly.max_nights
  if (config.weekly.enabled && numNights >= config.weekly.min_nights) {
    return {
      type: 'weekly',
      reason: `Weekly rate for ${config.weekly.min_nights}+ nights`,
    }
  }

  // Default to nightly
  return {
    type: 'nightly',
    reason: 'Standard nightly rate',
  }
}

/**
 * Find a seasonal period that fully contains the stay dates.
 *
 * The ENTIRE stay must fall within the seasonal period for it to match.
 * Returns the first matching period if multiple seasons overlap.
 *
 * @param checkInDate - Check-in date (YYYY-MM-DD)
 * @param checkOutDate - Check-out date (YYYY-MM-DD)
 * @param periods - Array of seasonal periods to check
 * @returns Matching seasonal period or null if no match
 */
export function findMatchingSeasonalPeriod(
  checkInDate: string,
  checkOutDate: string,
  periods: SeasonalPeriod[]
): SeasonalPeriod | null {
  if (periods.length === 0) {
    return null
  }

  for (const period of periods) {
    // Check if both check-in and check-out dates fall within the period
    if (
      isDateInSeasonalPeriod(checkInDate, period) &&
      isDateInSeasonalPeriod(checkOutDate, period)
    ) {
      return period
    }
  }

  return null
}

/**
 * Check if a date falls within a seasonal period.
 *
 * Handles cross-year seasons (e.g., Dec 1 - Feb 28).
 * Uses month/day comparison to support recurring annual seasons.
 *
 * @param dateStr - Date to check (YYYY-MM-DD)
 * @param period - Seasonal period to check against
 * @returns True if date is within the period
 */
export function isDateInSeasonalPeriod(
  dateStr: string,
  period: SeasonalPeriod
): boolean {
  // Parse date string directly to avoid timezone issues
  // Format: YYYY-MM-DD
  const parts = dateStr.split('-')
  const monthStr = parts[1] ?? '1'
  const dayStr = parts[2] ?? '1'
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  // Create comparable values (month * 100 + day gives us a sortable number)
  // e.g., June 15 = 615, December 25 = 1225
  const dateValue = month * 100 + day
  const startValue = period.start_month * 100 + period.start_day
  const endValue = period.end_month * 100 + period.end_day

  // Check if this is a cross-year season (e.g., winter: Dec-Feb)
  const isCrossYear = startValue > endValue

  if (isCrossYear) {
    // For cross-year seasons, date is in period if:
    // - It's >= start (e.g., Dec 1+) OR
    // - It's <= end (e.g., up to Feb 28)
    // But NOT in the gap between end and start
    return dateValue >= startValue || dateValue <= endValue
  } else {
    // For same-year seasons, date must be between start and end (inclusive)
    return dateValue >= startValue && dateValue <= endValue
  }
}

/**
 * Calculate the seasonal price for a booking.
 *
 * Seasonal pricing uses a FLAT RATE for the entire season,
 * not a per-night calculation.
 *
 * @param period - The seasonal period
 * @param siteRate - Optional site-specific rate override
 * @returns Price calculation result
 */
export function calculateSeasonalPrice(
  period: SeasonalPeriod,
  siteRate: SiteSeasonalRate | null
): {
  total_cents: number
  rate_type: 'seasonal'
  season_name: string
} {
  // Use site override if available, otherwise use period base rate
  const rateCents = siteRate?.rate_cents ?? period.base_rate_cents

  return {
    total_cents: rateCents,
    rate_type: 'seasonal',
    season_name: period.name,
  }
}

/**
 * Get enabled reservation types for a site.
 *
 * Resolves site override against property defaults.
 *
 * @param propertyTypes - Property-level enabled types
 * @param siteOverride - Site-level override (null = use property default)
 * @returns Array of enabled booking types
 */
export function resolveEnabledReservationTypes(
  propertyTypes: BookingType[] | null,
  siteOverride: BookingType[] | null
): BookingType[] {
  if (siteOverride && siteOverride.length > 0) {
    return siteOverride
  }
  return propertyTypes || ['nightly', 'weekly', 'monthly']
}

/**
 * Check if a site supports a specific reservation type.
 *
 * @param reservationType - Type to check
 * @param enabledTypes - Array of enabled types for the site
 * @returns True if the type is enabled
 */
export function isSiteReservationTypeEnabled(
  reservationType: BookingType,
  enabledTypes: BookingType[]
): boolean {
  return enabledTypes.includes(reservationType)
}

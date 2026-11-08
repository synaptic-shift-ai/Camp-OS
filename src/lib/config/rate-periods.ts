/**
 * Rate Period Thresholds
 *
 * Resolves how many nights a weekly or monthly rate covers. Block pricing
 * hardcoded 7 and 28 even though `PropertyReservationTypesConfig` has carried
 * configurable `min_nights` / `max_nights` per period all along, with UI at
 * reservation-type-settings.tsx and per-site-type overrides in
 * `site_type_config.site_type_rates`.
 *
 * `min_nights` is both the threshold and the block size: a monthly rate covers
 * `monthly.min_nights` nights, so one configured value drives the comparison
 * and the arithmetic.
 *
 * @module lib/config/rate-periods
 */

import { DEFAULT_RESERVATION_TYPES_CONFIG } from './types'
import type { PropertyReservationTypesConfig, SiteTypeRateBundle } from './types'

export type RatePeriodName = 'nightly' | 'weekly' | 'monthly'

export type RatePeriodThresholds = {
  /** Minimum nights for this period to apply, and the nights one block covers. */
  minNights: number

  /** Upper bound, or null for none. Kept for validation and display. */
  maxNights: number | null
}

export type EffectiveRatePeriods = Record<RatePeriodName, RatePeriodThresholds>

const PERIOD_NAMES: readonly RatePeriodName[] = ['nightly', 'weekly', 'monthly']

/** Longest period first: the cascade that period selection walks. */
const SELECTION_ORDER: readonly Exclude<RatePeriodName, 'nightly'>[] = ['monthly', 'weekly']

/** Canonical fallback, derived from the property defaults rather than restated. */
export const DEFAULT_RATE_PERIODS: EffectiveRatePeriods = Object.fromEntries(
  PERIOD_NAMES.map((period) => [
    period,
    {
      minNights: DEFAULT_RESERVATION_TYPES_CONFIG[period].min_nights,
      maxNights: DEFAULT_RESERVATION_TYPES_CONFIG[period].max_nights,
    },
  ]),
) as EffectiveRatePeriods

/**
 * Effective thresholds for each rate period.
 *
 * Precedence per period, matching the site-overrides-property convention in
 * `resolvePricingConfig` (resolution.ts): **per-site-type → property →
 * defaults**. A period is only taken from the site-type bundle when it actually
 * carries thresholds; a bundle entry holding only `rate_cents` inherits.
 */
export function resolveRatePeriods(
  propertyConfig: PropertyReservationTypesConfig | null | undefined,
  siteTypeBundle: SiteTypeRateBundle | null | undefined,
): EffectiveRatePeriods {
  const resolved = {} as EffectiveRatePeriods

  for (const period of PERIOD_NAMES) {
    const fallback = DEFAULT_RATE_PERIODS[period]
    const fromProperty = propertyConfig?.[period]
    const fromSiteType = siteTypeBundle?.[period]

    const minNights =
      typeof fromSiteType?.min_nights === 'number'
        ? fromSiteType.min_nights
        : typeof fromProperty?.min_nights === 'number'
          ? fromProperty.min_nights
          : fallback.minNights

    // Checked for presence, not coalesced, so a deliberate null meaning
    // "unbounded" survives instead of being replaced by a default bound.
    const maxNights =
      fromSiteType && 'max_nights' in fromSiteType
        ? (fromSiteType.max_nights ?? null)
        : fromProperty && 'max_nights' in fromProperty
          ? (fromProperty.max_nights ?? null)
          : fallback.maxNights

    resolved[period] = { minNights, maxNights }
  }

  return resolved
}

/**
 * The rate period a stay of this length bills under.
 *
 * Walks longest period first, requiring both the threshold to be met and a rate
 * to exist. `maxNights` is deliberately not enforced: the ordered cascade makes
 * it redundant, and enforcing it would bill a 30-night stay at nightly rates
 * where a property has no monthly rate configured — today it bills as weeks
 * plus nights, which is cheaper for the guest.
 */
export function selectRatePeriod(
  nights: number,
  periods: EffectiveRatePeriods,
  hasRate: { weekly: boolean; monthly: boolean },
): RatePeriodName {
  for (const period of SELECTION_ORDER) {
    if (hasRate[period] && nights >= periods[period].minNights) {
      return period
    }
  }
  return 'nightly'
}

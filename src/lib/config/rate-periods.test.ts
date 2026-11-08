/**
 * Tests for rate-period threshold resolution.
 *
 * S-0.4: block pricing hardcoded a week as 7 nights and a month as 28, in 22
 * places, while PropertyReservationTypesConfig has carried configurable
 * min_nights / max_nights per period all along with UI at
 * reservation-type-settings.tsx. pricing-enhanced.ts even loaded that config
 * and read rates out of it while ignoring the thresholds in the same object.
 */

import { describe, test, expect } from 'vitest'
import { resolveRatePeriods, selectRatePeriod, DEFAULT_RATE_PERIODS } from './rate-periods'
import type { PropertyReservationTypesConfig, SiteTypeRateBundle } from './types'

const CANONICAL = {
  nightlyMin: 1,
  weeklyMin: 7,
  weeklyMax: 27,
  monthlyMin: 28,
} as const

/** A property that bills a month as 30 nights rather than the default 28. */
const THIRTY_NIGHT_MONTH = 30

const propertyConfig = (
  over: Partial<PropertyReservationTypesConfig> = {},
): PropertyReservationTypesConfig => ({
  nightly: { enabled: true, min_nights: CANONICAL.nightlyMin, max_nights: 6, rate_cents: null },
  weekly: { enabled: true, min_nights: CANONICAL.weeklyMin, max_nights: CANONICAL.weeklyMax, rate_cents: null },
  monthly: { enabled: true, min_nights: CANONICAL.monthlyMin, max_nights: null, rate_cents: null },
  seasonal: { enabled: false, min_nights: 1, max_nights: null, rate_cents: null, flat_rate: true },
  ...over,
})

const allRatesAvailable = { weekly: true, monthly: true }

describe('DEFAULT_RATE_PERIODS', () => {
  test('matches the canonical property defaults, so an unconfigured property bills as it does today', () => {
    expect(DEFAULT_RATE_PERIODS).toEqual({
      nightly: { minNights: CANONICAL.nightlyMin, maxNights: 6 },
      weekly: { minNights: CANONICAL.weeklyMin, maxNights: CANONICAL.weeklyMax },
      monthly: { minNights: CANONICAL.monthlyMin, maxNights: null },
    })
  })
})

describe('resolveRatePeriods', () => {
  test('falls back to the canonical defaults when nothing is configured', () => {
    expect(resolveRatePeriods(null, null)).toEqual(DEFAULT_RATE_PERIODS)
  })

  test('takes thresholds from the property configuration', () => {
    const resolved = resolveRatePeriods(
      propertyConfig({
        monthly: { enabled: true, min_nights: THIRTY_NIGHT_MONTH, max_nights: null, rate_cents: null },
      }),
      null,
    )
    expect(resolved.monthly).toEqual({ minNights: THIRTY_NIGHT_MONTH, maxNights: null })
  })

  test('lets a per-site-type threshold override the property one', () => {
    const SITE_TYPE_WEEKLY_MIN = 5
    const bundle: SiteTypeRateBundle = {
      weekly: { rate_cents: null, min_nights: SITE_TYPE_WEEKLY_MIN, max_nights: 20 },
    }
    const resolved = resolveRatePeriods(propertyConfig(), bundle)
    expect(resolved.weekly).toEqual({ minNights: SITE_TYPE_WEEKLY_MIN, maxNights: 20 })
  })

  test('inherits the property threshold for a period the site type does not override', () => {
    const bundle: SiteTypeRateBundle = {
      weekly: { rate_cents: null, min_nights: 5, max_nights: 20 },
    }
    const resolved = resolveRatePeriods(propertyConfig(), bundle)
    expect(resolved.monthly).toEqual({ minNights: CANONICAL.monthlyMin, maxNights: null })
  })

  test('applies all three precedence levels at once', () => {
    const bundle: SiteTypeRateBundle = {
      nightly: { rate_cents: null, min_nights: 2, max_nights: 4 },
    }
    const resolved = resolveRatePeriods(
      propertyConfig({
        weekly: { enabled: true, min_nights: 6, max_nights: 29, rate_cents: null },
      }),
      bundle,
    )
    expect(resolved).toEqual({
      nightly: { minNights: 2, maxNights: 4 }, // site type
      weekly: { minNights: 6, maxNights: 29 }, // property
      monthly: { minNights: CANONICAL.monthlyMin, maxNights: null }, // property (unchanged default)
    })
  })

  test('preserves a deliberate null max_nights rather than substituting a bound', () => {
    const bundle: SiteTypeRateBundle = {
      weekly: { rate_cents: null, min_nights: CANONICAL.weeklyMin, max_nights: null },
    }
    const resolved = resolveRatePeriods(propertyConfig(), bundle)
    expect(resolved.weekly.maxNights).toBeNull()
  })

  test('ignores a site-type period that carries only a rate and no thresholds', () => {
    const bundle = { weekly: { rate_cents: 27000 } } as unknown as SiteTypeRateBundle
    const resolved = resolveRatePeriods(propertyConfig(), bundle)
    expect(resolved.weekly).toEqual({
      minNights: CANONICAL.weeklyMin,
      maxNights: CANONICAL.weeklyMax,
    })
  })
})

describe('selectRatePeriod', () => {
  const periods = DEFAULT_RATE_PERIODS

  test('selects nightly below the weekly threshold', () => {
    expect(selectRatePeriod(CANONICAL.weeklyMin - 1, periods, allRatesAvailable)).toBe('nightly')
  })

  test('selects weekly exactly at the weekly threshold', () => {
    expect(selectRatePeriod(CANONICAL.weeklyMin, periods, allRatesAvailable)).toBe('weekly')
  })

  test('selects weekly one night below the monthly threshold', () => {
    expect(selectRatePeriod(CANONICAL.monthlyMin - 1, periods, allRatesAvailable)).toBe('weekly')
  })

  test('selects monthly exactly at the monthly threshold', () => {
    expect(selectRatePeriod(CANONICAL.monthlyMin, periods, allRatesAvailable)).toBe('monthly')
  })

  test('falls through to weekly when no monthly rate exists, rather than billing nightly', () => {
    expect(
      selectRatePeriod(CANONICAL.monthlyMin, periods, { weekly: true, monthly: false }),
    ).toBe('weekly')
  })

  test('falls through to nightly when neither block rate exists', () => {
    expect(
      selectRatePeriod(CANONICAL.monthlyMin, periods, { weekly: false, monthly: false }),
    ).toBe('nightly')
  })

  test('honours a configured 30-night month: 29 nights is weekly', () => {
    const configured = resolveRatePeriods(
      propertyConfig({
        monthly: { enabled: true, min_nights: THIRTY_NIGHT_MONTH, max_nights: null, rate_cents: null },
      }),
      null,
    )
    expect(selectRatePeriod(THIRTY_NIGHT_MONTH - 1, configured, allRatesAvailable)).toBe('weekly')
  })

  test('honours a configured 30-night month: 30 nights is monthly', () => {
    const configured = resolveRatePeriods(
      propertyConfig({
        monthly: { enabled: true, min_nights: THIRTY_NIGHT_MONTH, max_nights: null, rate_cents: null },
      }),
      null,
    )
    expect(selectRatePeriod(THIRTY_NIGHT_MONTH, configured, allRatesAvailable)).toBe('monthly')
  })

  test('selects nightly for a single night', () => {
    expect(selectRatePeriod(1, periods, allRatesAvailable)).toBe('nightly')
  })
})

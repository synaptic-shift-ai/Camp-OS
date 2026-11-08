/**
 * Tests for block pricing (weekly / monthly rate periods).
 *
 * Colocated here rather than in pricing.test.ts, which vitest.config.ts
 * excludes from the suite as "Legacy - requires real Supabase". These two
 * functions are pure, so they can and should be covered by tests that run.
 *
 * S-0.4: both functions hardcoded a week as 7 nights and a month as 28, in both
 * the threshold comparison and the block arithmetic, ignoring the configurable
 * min_nights the property carries.
 */

import { describe, test, expect } from 'vitest'
import { calculateBaseSubtotalCents, getBaseSubtotalAndLabel } from './pricing'
import { resolveRatePeriods, DEFAULT_RATE_PERIODS } from '@/lib/config/rate-periods'
import type { PropertyReservationTypesConfig } from '@/lib/config/types'

const NIGHTLY = 45_00
const WEEKLY = 270_00
const MONTHLY = 900_00

const DEFAULT_WEEK = 7
const DEFAULT_MONTH = 28
const THIRTY_NIGHT_MONTH = 30

const configWithMonthlyMin = (minNights: number): PropertyReservationTypesConfig => ({
  nightly: { enabled: true, min_nights: 1, max_nights: 6, rate_cents: null },
  weekly: { enabled: true, min_nights: DEFAULT_WEEK, max_nights: minNights - 1, rate_cents: null },
  monthly: { enabled: true, min_nights: minNights, max_nights: null, rate_cents: null },
  seasonal: { enabled: false, min_nights: 1, max_nights: null, rate_cents: null, flat_rate: true },
})

describe('calculateBaseSubtotalCents', () => {
  test('bills nightly below the weekly threshold', () => {
    const nights = DEFAULT_WEEK - 1
    expect(
      calculateBaseSubtotalCents(nights, NIGHTLY, WEEKLY, MONTHLY, DEFAULT_RATE_PERIODS),
    ).toBe(nights * NIGHTLY)
  })

  test('bills one week at exactly the weekly threshold', () => {
    expect(
      calculateBaseSubtotalCents(DEFAULT_WEEK, NIGHTLY, WEEKLY, MONTHLY, DEFAULT_RATE_PERIODS),
    ).toBe(WEEKLY)
  })

  test('bills whole weeks plus remainder nights', () => {
    const nights = DEFAULT_WEEK * 2 + 3
    expect(
      calculateBaseSubtotalCents(nights, NIGHTLY, WEEKLY, MONTHLY, DEFAULT_RATE_PERIODS),
    ).toBe(2 * WEEKLY + 3 * NIGHTLY)
  })

  test('bills one month at exactly the monthly threshold', () => {
    expect(
      calculateBaseSubtotalCents(DEFAULT_MONTH, NIGHTLY, WEEKLY, MONTHLY, DEFAULT_RATE_PERIODS),
    ).toBe(MONTHLY)
  })

  test('bills whole months plus remainder nights', () => {
    const nights = DEFAULT_MONTH + 5
    expect(
      calculateBaseSubtotalCents(nights, NIGHTLY, WEEKLY, MONTHLY, DEFAULT_RATE_PERIODS),
    ).toBe(MONTHLY + 5 * NIGHTLY)
  })

  test('falls back to weekly when no monthly rate is configured', () => {
    const nights = DEFAULT_MONTH + 2
    expect(calculateBaseSubtotalCents(nights, NIGHTLY, WEEKLY, null, DEFAULT_RATE_PERIODS)).toBe(
      Math.floor(nights / DEFAULT_WEEK) * WEEKLY + (nights % DEFAULT_WEEK) * NIGHTLY,
    )
  })

  test('falls back to nightly when neither block rate is configured', () => {
    const nights = DEFAULT_MONTH + 2
    expect(calculateBaseSubtotalCents(nights, NIGHTLY, null, null, DEFAULT_RATE_PERIODS)).toBe(
      nights * NIGHTLY,
    )
  })

  test('treats a zero block rate as not configured', () => {
    expect(
      calculateBaseSubtotalCents(DEFAULT_WEEK, NIGHTLY, 0, null, DEFAULT_RATE_PERIODS),
    ).toBe(DEFAULT_WEEK * NIGHTLY)
  })

  // --- the point of S-0.4 ---

  test('a property billing a 30-night month charges 29 nights as weeks plus nights', () => {
    const periods = resolveRatePeriods(configWithMonthlyMin(THIRTY_NIGHT_MONTH), null)
    const nights = THIRTY_NIGHT_MONTH - 1
    expect(calculateBaseSubtotalCents(nights, NIGHTLY, WEEKLY, MONTHLY, periods)).toBe(
      Math.floor(nights / DEFAULT_WEEK) * WEEKLY + (nights % DEFAULT_WEEK) * NIGHTLY,
    )
  })

  test('a property billing a 30-night month charges 30 nights as one month', () => {
    const periods = resolveRatePeriods(configWithMonthlyMin(THIRTY_NIGHT_MONTH), null)
    expect(
      calculateBaseSubtotalCents(THIRTY_NIGHT_MONTH, NIGHTLY, WEEKLY, MONTHLY, periods),
    ).toBe(MONTHLY)
  })

  test('a 28-night configuration reproduces the previous hardcoded output exactly', () => {
    const periods = resolveRatePeriods(configWithMonthlyMin(DEFAULT_MONTH), null)
    for (const nights of [1, 6, 7, 13, 14, 27, 28, 29, 56, 60]) {
      expect(calculateBaseSubtotalCents(nights, NIGHTLY, WEEKLY, MONTHLY, periods)).toBe(
        calculateBaseSubtotalCents(nights, NIGHTLY, WEEKLY, MONTHLY, DEFAULT_RATE_PERIODS),
      )
    }
  })

  test('uses the configured block size for the arithmetic, not just the threshold', () => {
    const periods = resolveRatePeriods(configWithMonthlyMin(THIRTY_NIGHT_MONTH), null)
    const nights = THIRTY_NIGHT_MONTH + 4
    // One 30-night month plus 4 nights, not one 28-night month plus 6.
    expect(calculateBaseSubtotalCents(nights, NIGHTLY, WEEKLY, MONTHLY, periods)).toBe(
      MONTHLY + 4 * NIGHTLY,
    )
  })
})

describe('getBaseSubtotalAndLabel', () => {
  test('reports the nightly rate type and a per-night label', () => {
    const result = getBaseSubtotalAndLabel(3, NIGHTLY, WEEKLY, MONTHLY, DEFAULT_RATE_PERIODS)
    expect(result).toEqual({
      subtotalCents: 3 * NIGHTLY,
      basePriceLabel: expect.stringContaining('night'),
      rateType: 'nightly',
    })
  })

  test('reports the weekly rate type at the weekly threshold', () => {
    const result = getBaseSubtotalAndLabel(
      DEFAULT_WEEK,
      NIGHTLY,
      WEEKLY,
      MONTHLY,
      DEFAULT_RATE_PERIODS,
    )
    expect(result.rateType).toBe('weekly')
    expect(result.subtotalCents).toBe(WEEKLY)
  })

  test('reports the monthly rate type at the monthly threshold', () => {
    const result = getBaseSubtotalAndLabel(
      DEFAULT_MONTH,
      NIGHTLY,
      WEEKLY,
      MONTHLY,
      DEFAULT_RATE_PERIODS,
    )
    expect(result.rateType).toBe('monthly')
    expect(result.subtotalCents).toBe(MONTHLY)
  })

  test('labels a remainder alongside whole blocks', () => {
    const result = getBaseSubtotalAndLabel(
      DEFAULT_WEEK + 2,
      NIGHTLY,
      WEEKLY,
      MONTHLY,
      DEFAULT_RATE_PERIODS,
    )
    expect(result.basePriceLabel).toContain('1 week')
    expect(result.basePriceLabel).toContain('2 night')
  })

  test('subtotal always agrees with calculateBaseSubtotalCents', () => {
    const periods = resolveRatePeriods(configWithMonthlyMin(THIRTY_NIGHT_MONTH), null)
    for (const nights of [1, 7, 29, 30, 34]) {
      expect(getBaseSubtotalAndLabel(nights, NIGHTLY, WEEKLY, MONTHLY, periods).subtotalCents).toBe(
        calculateBaseSubtotalCents(nights, NIGHTLY, WEEKLY, MONTHLY, periods),
      )
    }
  })
})

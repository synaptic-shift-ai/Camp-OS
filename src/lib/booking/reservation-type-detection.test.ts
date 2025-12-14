/**
 * Reservation Type Detection Tests
 *
 * TDD tests for auto-detecting the best reservation type based on
 * stay length and seasonal periods.
 *
 * Risk Classification: CRITICAL (pricing logic)
 * Coverage Target: 100%
 */

import { describe, test, expect } from 'vitest'
import {
  detectBestReservationType,
  findMatchingSeasonalPeriod,
  isDateInSeasonalPeriod,
  calculateSeasonalPrice,
} from './reservation-type-detection'
import type {
  PropertyReservationTypesConfig,
  SeasonalPeriod,
  SiteSeasonalRate,
} from '@/lib/config/types'

// =====================================================
// Test Fixtures
// =====================================================

const defaultConfig: PropertyReservationTypesConfig = {
  nightly: { enabled: true, min_nights: 1, max_nights: 6 },
  weekly: { enabled: true, min_nights: 7, max_nights: 27 },
  monthly: { enabled: true, min_nights: 28, max_nights: null },
  seasonal: { enabled: false, min_nights: 1, max_nights: null, flat_rate: true },
}

const configWithSeasonal: PropertyReservationTypesConfig = {
  ...defaultConfig,
  seasonal: { enabled: true, min_nights: 1, max_nights: null, flat_rate: true },
}

const summerSeason: SeasonalPeriod = {
  id: 'season-summer',
  property_id: 'prop-1',
  name: 'Summer Season',
  start_month: 6,
  start_day: 1,
  end_month: 8,
  end_day: 31,
  base_rate_cents: 350000, // $3,500 flat rate
  recurring: true,
}

const winterSeason: SeasonalPeriod = {
  id: 'season-winter',
  property_id: 'prop-1',
  name: 'Winter Season',
  start_month: 12,
  start_day: 1,
  end_month: 2,
  end_day: 28,
  base_rate_cents: 200000, // $2,000 flat rate
  recurring: true,
}

// =====================================================
// detectBestReservationType Tests
// =====================================================

describe('detectBestReservationType', () => {
  describe('nightly rate detection', () => {
    test('returns nightly for 1-night stay', () => {
      const result = detectBestReservationType(
        1,
        '2025-07-01',
        '2025-07-02',
        defaultConfig,
        []
      )

      expect(result).toEqual({
        type: 'nightly',
        reason: 'Standard nightly rate',
      })
    })

    test('returns nightly for 6-night stay (max for nightly)', () => {
      const result = detectBestReservationType(
        6,
        '2025-07-01',
        '2025-07-07',
        defaultConfig,
        []
      )

      expect(result).toEqual({
        type: 'nightly',
        reason: 'Standard nightly rate',
      })
    })
  })

  describe('weekly rate detection', () => {
    test('returns weekly for 7-night stay', () => {
      const result = detectBestReservationType(
        7,
        '2025-07-01',
        '2025-07-08',
        defaultConfig,
        []
      )

      expect(result).toEqual({
        type: 'weekly',
        reason: 'Weekly rate for 7+ nights',
      })
    })

    test('returns weekly for 14-night stay', () => {
      const result = detectBestReservationType(
        14,
        '2025-07-01',
        '2025-07-15',
        defaultConfig,
        []
      )

      expect(result).toEqual({
        type: 'weekly',
        reason: 'Weekly rate for 7+ nights',
      })
    })

    test('returns weekly for 27-night stay (max for weekly)', () => {
      const result = detectBestReservationType(
        27,
        '2025-07-01',
        '2025-07-28',
        defaultConfig,
        []
      )

      expect(result).toEqual({
        type: 'weekly',
        reason: 'Weekly rate for 7+ nights',
      })
    })
  })

  describe('monthly rate detection', () => {
    test('returns monthly for 28-night stay', () => {
      const result = detectBestReservationType(
        28,
        '2025-07-01',
        '2025-07-29',
        defaultConfig,
        []
      )

      expect(result).toEqual({
        type: 'monthly',
        reason: 'Monthly rate for 28+ nights',
      })
    })

    test('returns monthly for 60-night stay', () => {
      const result = detectBestReservationType(
        60,
        '2025-07-01',
        '2025-08-30',
        defaultConfig,
        []
      )

      expect(result).toEqual({
        type: 'monthly',
        reason: 'Monthly rate for 28+ nights',
      })
    })
  })

  describe('seasonal rate detection', () => {
    test('returns seasonal when dates fall within seasonal period and seasonal is enabled', () => {
      const result = detectBestReservationType(
        30,
        '2025-06-15',
        '2025-07-15',
        configWithSeasonal,
        [summerSeason]
      )

      expect(result).toEqual({
        type: 'seasonal',
        reason: 'Summer Season rates apply',
        seasonal_period: summerSeason,
      })
    })

    test('returns monthly when seasonal is disabled even if dates match season', () => {
      const result = detectBestReservationType(
        30,
        '2025-06-15',
        '2025-07-15',
        defaultConfig, // seasonal disabled
        [summerSeason]
      )

      expect(result).toEqual({
        type: 'monthly',
        reason: 'Monthly rate for 28+ nights',
      })
    })

    test('returns nightly when dates do not fall within any seasonal period', () => {
      const result = detectBestReservationType(
        3,
        '2025-04-01',
        '2025-04-04',
        configWithSeasonal,
        [summerSeason]
      )

      expect(result).toEqual({
        type: 'nightly',
        reason: 'Standard nightly rate',
      })
    })
  })

  describe('respects disabled reservation types', () => {
    test('returns nightly when weekly is disabled for 10-night stay', () => {
      const configWeeklyDisabled: PropertyReservationTypesConfig = {
        ...defaultConfig,
        weekly: { enabled: false, min_nights: 7, max_nights: 27 },
      }

      const result = detectBestReservationType(
        10,
        '2025-07-01',
        '2025-07-11',
        configWeeklyDisabled,
        []
      )

      expect(result).toEqual({
        type: 'nightly',
        reason: 'Standard nightly rate',
      })
    })

    test('returns weekly when monthly is disabled for 30-night stay', () => {
      const configMonthlyDisabled: PropertyReservationTypesConfig = {
        ...defaultConfig,
        monthly: { enabled: false, min_nights: 28, max_nights: null },
      }

      const result = detectBestReservationType(
        30,
        '2025-07-01',
        '2025-07-31',
        configMonthlyDisabled,
        []
      )

      expect(result).toEqual({
        type: 'weekly',
        reason: 'Weekly rate for 7+ nights',
      })
    })
  })

  describe('edge cases', () => {
    test('handles zero nights gracefully', () => {
      const result = detectBestReservationType(
        0,
        '2025-07-01',
        '2025-07-01',
        defaultConfig,
        []
      )

      expect(result).toEqual({
        type: 'nightly',
        reason: 'Standard nightly rate',
      })
    })

    test('handles boundary between weekly and monthly (27 vs 28 nights)', () => {
      const result27 = detectBestReservationType(
        27,
        '2025-07-01',
        '2025-07-28',
        defaultConfig,
        []
      )
      const result28 = detectBestReservationType(
        28,
        '2025-07-01',
        '2025-07-29',
        defaultConfig,
        []
      )

      expect(result27.type).toBe('weekly')
      expect(result28.type).toBe('monthly')
    })
  })
})

// =====================================================
// findMatchingSeasonalPeriod Tests
// =====================================================

describe('findMatchingSeasonalPeriod', () => {
  test('returns matching season when entire stay is within period', () => {
    const result = findMatchingSeasonalPeriod(
      '2025-06-15',
      '2025-07-15',
      [summerSeason]
    )

    expect(result).toEqual(summerSeason)
  })

  test('returns null when stay starts before season', () => {
    const result = findMatchingSeasonalPeriod(
      '2025-05-15',
      '2025-06-15',
      [summerSeason]
    )

    expect(result).toBeNull()
  })

  test('returns null when stay ends after season', () => {
    const result = findMatchingSeasonalPeriod(
      '2025-08-15',
      '2025-09-15',
      [summerSeason]
    )

    expect(result).toBeNull()
  })

  test('returns null when no seasons are defined', () => {
    const result = findMatchingSeasonalPeriod(
      '2025-06-15',
      '2025-07-15',
      []
    )

    expect(result).toBeNull()
  })

  test('returns first matching season when multiple seasons match', () => {
    const overlappingSeason: SeasonalPeriod = {
      ...summerSeason,
      id: 'season-peak',
      name: 'Peak Summer',
      start_month: 7,
      start_day: 1,
      end_month: 7,
      end_day: 31,
    }

    const result = findMatchingSeasonalPeriod(
      '2025-07-10',
      '2025-07-20',
      [summerSeason, overlappingSeason]
    )

    // Should return first match (summerSeason)
    expect(result).toEqual(summerSeason)
  })

  describe('cross-year seasonal periods', () => {
    test('handles winter season crossing year boundary', () => {
      // Winter: Dec 1 - Feb 28
      const result = findMatchingSeasonalPeriod(
        '2025-12-15',
        '2026-01-15',
        [winterSeason]
      )

      expect(result).toEqual(winterSeason)
    })

    test('handles stay entirely in January for cross-year season', () => {
      const result = findMatchingSeasonalPeriod(
        '2026-01-05',
        '2026-01-25',
        [winterSeason]
      )

      expect(result).toEqual(winterSeason)
    })
  })
})

// =====================================================
// isDateInSeasonalPeriod Tests
// =====================================================

describe('isDateInSeasonalPeriod', () => {
  test('returns true for date within summer season', () => {
    expect(isDateInSeasonalPeriod('2025-07-15', summerSeason)).toBe(true)
  })

  test('returns true for first day of season', () => {
    expect(isDateInSeasonalPeriod('2025-06-01', summerSeason)).toBe(true)
  })

  test('returns true for last day of season', () => {
    expect(isDateInSeasonalPeriod('2025-08-31', summerSeason)).toBe(true)
  })

  test('returns false for date before season', () => {
    expect(isDateInSeasonalPeriod('2025-05-31', summerSeason)).toBe(false)
  })

  test('returns false for date after season', () => {
    expect(isDateInSeasonalPeriod('2025-09-01', summerSeason)).toBe(false)
  })

  test('handles cross-year winter season - December date', () => {
    expect(isDateInSeasonalPeriod('2025-12-15', winterSeason)).toBe(true)
  })

  test('handles cross-year winter season - January date', () => {
    expect(isDateInSeasonalPeriod('2026-01-15', winterSeason)).toBe(true)
  })

  test('handles cross-year winter season - March date (outside)', () => {
    expect(isDateInSeasonalPeriod('2026-03-01', winterSeason)).toBe(false)
  })
})

// =====================================================
// calculateSeasonalPrice Tests
// =====================================================

describe('calculateSeasonalPrice', () => {
  test('uses season base rate when no site override exists', () => {
    const result = calculateSeasonalPrice(summerSeason, null)

    expect(result).toEqual({
      total_cents: 350000,
      rate_type: 'seasonal',
      season_name: 'Summer Season',
    })
  })

  test('uses site override rate when provided', () => {
    const siteRate: SiteSeasonalRate = {
      id: 'rate-1',
      site_id: 'site-1',
      seasonal_period_id: 'season-summer',
      rate_cents: 400000, // $4,000 premium site
    }

    const result = calculateSeasonalPrice(summerSeason, siteRate)

    expect(result).toEqual({
      total_cents: 400000,
      rate_type: 'seasonal',
      season_name: 'Summer Season',
    })
  })

  test('returns flat rate (not per-night calculation)', () => {
    // Verify that the rate is flat, not multiplied by nights
    const result = calculateSeasonalPrice(summerSeason, null)

    // Flat rate should be exactly the base_rate_cents, regardless of stay length
    expect(result.total_cents).toBe(summerSeason.base_rate_cents)
  })
})

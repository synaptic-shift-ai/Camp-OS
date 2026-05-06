/**
 * Tests for Configuration Resolution Functions
 *
 * @module lib/config/resolution.test
 */

import { describe, test, expect } from 'vitest'
import {
  parsePaymentProcessorList,
  resolvePaymentProcessor,
  resolveReservationTypeRate,
  resolveReservationTypeRateWithSource,
} from './resolution'
import type { PropertyReservationTypesConfig } from './types'

describe('resolveReservationTypeRate', () => {
  // Test data
  const baseSiteFallbackRates = {
    base_price: 5000, // $50/night
    weekly_rate_cents: null,
    monthly_rate_cents: null,
  }

  const propertyConfigWithRates: PropertyReservationTypesConfig = {
    nightly: { enabled: true, min_nights: 1, max_nights: 6, rate_cents: 6000 },
    weekly: { enabled: true, min_nights: 7, max_nights: 27, rate_cents: 5500 },
    monthly: { enabled: true, min_nights: 28, max_nights: null, rate_cents: 4500 },
    seasonal: { enabled: true, min_nights: 1, max_nights: null, flat_rate: true, rate_cents: 300000 },
  }

  const propertyConfigNoRates: PropertyReservationTypesConfig = {
    nightly: { enabled: true, min_nights: 1, max_nights: 6, rate_cents: null },
    weekly: { enabled: true, min_nights: 7, max_nights: 27, rate_cents: null },
    monthly: { enabled: true, min_nights: 28, max_nights: null, rate_cents: null },
    seasonal: { enabled: false, min_nights: 1, max_nights: null, flat_rate: true, rate_cents: null },
  }

  test('should return site override rate when present', () => {
    const siteOverride = { weekly: 4000 }

    const result = resolveReservationTypeRate(
      'weekly',
      propertyConfigWithRates,
      siteOverride,
      baseSiteFallbackRates
    )

    expect(result).toBe(4000)
  })

  test('should return site existing rate field for weekly when no override', () => {
    const siteFallbackRates = {
      base_price: 5000,
      weekly_rate_cents: 4500,
      monthly_rate_cents: null,
    }

    const result = resolveReservationTypeRate(
      'weekly',
      propertyConfigWithRates,
      null,
      siteFallbackRates
    )

    expect(result).toBe(4500)
  })

  test('should return site existing rate field for monthly when no override', () => {
    const siteFallbackRates = {
      base_price: 5000,
      weekly_rate_cents: null,
      monthly_rate_cents: 3500,
    }

    const result = resolveReservationTypeRate(
      'monthly',
      propertyConfigWithRates,
      null,
      siteFallbackRates
    )

    expect(result).toBe(3500)
  })

  test('should return property rate when no site override or field', () => {
    const result = resolveReservationTypeRate(
      'weekly',
      propertyConfigWithRates,
      null,
      baseSiteFallbackRates
    )

    expect(result).toBe(5500)
  })

  test('should return base_price when no rates are configured', () => {
    const result = resolveReservationTypeRate(
      'weekly',
      propertyConfigNoRates,
      null,
      baseSiteFallbackRates
    )

    expect(result).toBe(5000)
  })

  test('should return property rate for nightly type', () => {
    const result = resolveReservationTypeRate(
      'nightly',
      propertyConfigWithRates,
      null,
      baseSiteFallbackRates
    )

    expect(result).toBe(6000)
  })

  test('should return property rate for seasonal type', () => {
    const result = resolveReservationTypeRate(
      'seasonal',
      propertyConfigWithRates,
      null,
      baseSiteFallbackRates
    )

    expect(result).toBe(300000)
  })

  test('should prioritize site override over site field', () => {
    const siteOverride = { weekly: 3000 }
    const siteFallbackRates = {
      base_price: 5000,
      weekly_rate_cents: 4500,
      monthly_rate_cents: null,
    }

    const result = resolveReservationTypeRate(
      'weekly',
      propertyConfigWithRates,
      siteOverride,
      siteFallbackRates
    )

    expect(result).toBe(3000)
  })

  test('should handle undefined property config', () => {
    const result = resolveReservationTypeRate(
      'weekly',
      undefined,
      null,
      baseSiteFallbackRates
    )

    expect(result).toBe(5000)
  })

  test('should handle null property config', () => {
    const result = resolveReservationTypeRate(
      'monthly',
      null,
      null,
      baseSiteFallbackRates
    )

    expect(result).toBe(5000)
  })
})

describe('resolveReservationTypeRateWithSource', () => {
  const baseSiteFallbackRates = {
    base_price: 5000,
    weekly_rate_cents: null,
    monthly_rate_cents: null,
  }

  const propertyConfigWithRates: PropertyReservationTypesConfig = {
    nightly: { enabled: true, min_nights: 1, max_nights: 6, rate_cents: 6000 },
    weekly: { enabled: true, min_nights: 7, max_nights: 27, rate_cents: 5500 },
    monthly: { enabled: true, min_nights: 28, max_nights: null, rate_cents: 4500 },
    seasonal: { enabled: true, min_nights: 1, max_nights: null, flat_rate: true, rate_cents: 300000 },
  }

  test('should return site_override source when site override is used', () => {
    const siteOverride = { weekly: 4000 }

    const result = resolveReservationTypeRateWithSource(
      'weekly',
      propertyConfigWithRates,
      siteOverride,
      baseSiteFallbackRates
    )

    expect(result).toEqual({
      rate_cents: 4000,
      source: 'site_override',
      is_overridden: true,
    })
  })

  test('should return site_field source when site rate field is used', () => {
    const siteFallbackRates = {
      base_price: 5000,
      weekly_rate_cents: 4500,
      monthly_rate_cents: null,
    }

    const result = resolveReservationTypeRateWithSource(
      'weekly',
      propertyConfigWithRates,
      null,
      siteFallbackRates
    )

    expect(result).toEqual({
      rate_cents: 4500,
      source: 'site_field',
      is_overridden: true,
    })
  })

  test('should return property source when property rate is used', () => {
    const result = resolveReservationTypeRateWithSource(
      'weekly',
      propertyConfigWithRates,
      null,
      baseSiteFallbackRates
    )

    expect(result).toEqual({
      rate_cents: 5500,
      source: 'property',
      is_overridden: false,
    })
  })

  test('should return base_price source when base price is used', () => {
    const propertyConfigNoRates: PropertyReservationTypesConfig = {
      nightly: { enabled: true, min_nights: 1, max_nights: 6, rate_cents: null },
      weekly: { enabled: true, min_nights: 7, max_nights: 27, rate_cents: null },
      monthly: { enabled: true, min_nights: 28, max_nights: null, rate_cents: null },
      seasonal: { enabled: false, min_nights: 1, max_nights: null, flat_rate: true, rate_cents: null },
    }

    const result = resolveReservationTypeRateWithSource(
      'weekly',
      propertyConfigNoRates,
      null,
      baseSiteFallbackRates
    )

    expect(result).toEqual({
      rate_cents: 5000,
      source: 'base_price',
      is_overridden: false,
    })
  })
})

describe('parsePaymentProcessorList', () => {
  test('returns empty list for null and undefined', () => {
    expect(parsePaymentProcessorList(null)).toEqual([])
    expect(parsePaymentProcessorList(undefined)).toEqual([])
  })

  test('wraps a non-empty string as a single-element list', () => {
    expect(parsePaymentProcessorList('stripe')).toEqual(['stripe'])
  })

  test('trims string entries and drops blanks', () => {
    expect(parsePaymentProcessorList('  stripe  ')).toEqual(['stripe'])
    expect(parsePaymentProcessorList([' stripe ', '', '  '])).toEqual(['stripe'])
  })

  test('preserves custom processor ids and order', () => {
    expect(parsePaymentProcessorList(['custom_a', 'custom_b'])).toEqual(['custom_a', 'custom_b'])
  })
})

describe('resolvePaymentProcessor', () => {
  test('returns first supported type when list mixes custom and known ids', () => {
    expect(resolvePaymentProcessor(['future_gateway', 'campost_payments'])).toBe('campost_payments')
  })

  test('returns first supported type in array order', () => {
    expect(resolvePaymentProcessor(['stripe', 'campost_payments'])).toBe('stripe')
  })

  test('returns default when list is empty', () => {
    expect(resolvePaymentProcessor([])).toBe('stripe')
  })

  test('returns default when no supported type is present', () => {
    expect(resolvePaymentProcessor(['only_custom'])).toBe('stripe')
  })

  test('accepts legacy single string value', () => {
    expect(resolvePaymentProcessor('none')).toBe('none')
  })
})

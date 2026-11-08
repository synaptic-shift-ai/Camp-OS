/**
 * Tests for the guest stay quote.
 *
 * S-0.5: the guest booking portal computed money on the client while the server
 * computed it again at creation, with a different base — so a guest could be
 * quoted one figure and charged another. This query becomes the single
 * authority both call.
 *
 * Several tests below deliberately pin CURRENT behaviour, including two known
 * defects, because this step is a faithful extraction with no behaviour change.
 * They are marked and S-0.6 changes them on purpose.
 */

import { describe, test, expect } from 'vitest'
import { quoteStay, type QuoteStayInput } from '../QuoteStayQuery'

const NIGHTLY_CENTS = 45_00
const WEEKLY_CENTS = 270_00
const PET_FEE_CENTS = 15_00
const TAX_RATE = 0.07
const CHECK_IN = '2026-06-15'

/** Current fallback when a property has no tax rate configured. Removed in S-0.6. */
const LEGACY_DEFAULT_TAX_RATE = 0.085

const site = (over: Partial<QuoteStayInput['site']> = {}): QuoteStayInput['site'] => ({
  site_type: 'rv',
  base_price: NIGHTLY_CENTS,
  weekly_rate_cents: null,
  monthly_rate_cents: null,
  pricing_override: { base_price: NIGHTLY_CENTS },
  enabled_reservation_types_override: ['nightly'],
  ...over,
})

const property = (over: Partial<QuoteStayInput['property']> = {}): QuoteStayInput['property'] => ({
  pricing_config: { tax_rate: TAX_RATE, tax_name: 'Sales Tax' },
  rate_discounts_config: null,
  reservation_type_config: null,
  site_type_config: null,
  enabled_reservation_types: ['nightly'],
  ...over,
})

const input = (over: Partial<QuoteStayInput> = {}): QuoteStayInput => ({
  site: site(),
  property: property(),
  checkInDate: CHECK_IN,
  checkOutDate: '2026-06-18',
  numberOfNights: 3,
  numAdults: 2,
  numChildren: 0,
  numPets: 0,
  ...over,
})

describe('quoteStay', () => {
  test('prices a nightly stay as rate times nights', () => {
    const { breakdown } = quoteStay(input())
    expect(breakdown.subtotal).toBe(NIGHTLY_CENTS * 3)
  })

  test('taxes the subtotal at the property rate and adds it to the total', () => {
    const { breakdown } = quoteStay(input())
    const expectedTax = Math.round(NIGHTLY_CENTS * 3 * TAX_RATE)
    expect(breakdown.taxes).toBe(expectedTax)
    expect(breakdown.total).toBe(NIGHTLY_CENTS * 3 + expectedTax)
  })

  test('carries the configured tax name through for display', () => {
    const { breakdown } = quoteStay(input())
    expect(breakdown.tax_name).toBe('Sales Tax')
  })

  test('charges a pet fee configured as a has_pets flat amount', () => {
    const { breakdown } = quoteStay(
      input({
        numPets: 1,
        property: property({
          pricing_config: {
            tax_rate: TAX_RATE,
            user_defined_fees: [
              {
                id: 'fee-1',
                enabled: true,
                trigger_type: 'has_pets',
                fee_type: 'flat_amount',
                value_cents: PET_FEE_CENTS,
              },
            ],
          },
        }),
      }),
    )
    expect(breakdown.pet_fee).toBe(PET_FEE_CENTS)
    expect(breakdown.total).toBe(
      NIGHTLY_CENTS * 3 + Math.round(NIGHTLY_CENTS * 3 * TAX_RATE) + PET_FEE_CENTS,
    )
  })

  test('falls back to the legacy pet_fee_cents when no has_pets fee is configured', () => {
    const { breakdown } = quoteStay(
      input({
        numPets: 1,
        property: property({ pricing_config: { tax_rate: TAX_RATE, pet_fee_cents: PET_FEE_CENTS } }),
      }),
    )
    expect(breakdown.pet_fee).toBe(PET_FEE_CENTS)
  })

  test('charges no pet fee when the stay has no pets', () => {
    const { breakdown } = quoteStay(
      input({ property: property({ pricing_config: { tax_rate: TAX_RATE, pet_fee_cents: PET_FEE_CENTS } }) }),
    )
    expect(breakdown.pet_fee ?? 0).toBe(0)
  })

  test('auto-applies a min_nights discount once the stay is long enough', () => {
    const DISCOUNT_PCT = 10
    const { breakdown } = quoteStay(
      input({
        numberOfNights: 7,
        checkOutDate: '2026-06-22',
        property: property({
          rate_discounts_config: {
            user_defined_discounts: [
              {
                id: 'd-1',
                title: 'Week discount',
                enabled: true,
                trigger_type: 'min_nights',
                trigger_conditions: { min_nights: 7 },
                discount_type: 'percentage_of_subtotal',
                value_percentage: DISCOUNT_PCT,
              },
            ],
          },
        }),
      }),
    )
    const subtotal = NIGHTLY_CENTS * 7
    expect(breakdown.user_discounts).toEqual([
      { id: 'd-1', title: 'Week discount', amount: subtotal * DISCOUNT_PCT / 100, trigger_type: 'min_nights' },
    ])
  })

  test('does not auto-apply a manual discount, which staff must select', () => {
    const { breakdown } = quoteStay(
      input({
        property: property({
          rate_discounts_config: {
            user_defined_discounts: [
              {
                id: 'd-2',
                title: 'Manual',
                enabled: true,
                trigger_type: 'manual',
                discount_type: 'flat_amount',
                value_cents: 1000,
              },
            ],
          },
        }),
      }),
    )
    expect(breakdown.user_discounts ?? []).toEqual([])
  })

  test('taxes the post-discount subtotal', () => {
    const FLAT_DISCOUNT = 20_00
    const { breakdown } = quoteStay(
      input({
        property: property({
          rate_discounts_config: {
            user_defined_discounts: [
              {
                id: 'd-3',
                title: 'Promo',
                enabled: true,
                trigger_type: 'min_nights',
                trigger_conditions: { min_nights: 1 },
                discount_type: 'flat_amount',
                value_cents: FLAT_DISCOUNT,
              },
            ],
          },
        }),
      }),
    )
    expect(breakdown.taxes).toBe(Math.round((NIGHTLY_CENTS * 3 - FLAT_DISCOUNT) * TAX_RATE))
  })

  test('uses the weekly rate for a seven-night stay when one is configured', () => {
    const { breakdown } = quoteStay(
      input({
        numberOfNights: 7,
        checkOutDate: '2026-06-22',
        site: site({ weekly_rate_cents: WEEKLY_CENTS, enabled_reservation_types_override: ['nightly', 'weekly'] }),
        property: property({ enabled_reservation_types: ['nightly', 'weekly'] }),
      }),
    )
    expect(breakdown.subtotal).toBe(WEEKLY_CENTS)
    expect(breakdown.rate_type).toBe('weekly')
  })

  // --- Pins of current behaviour that S-0.6 deliberately changes ---

  test('PINS CURRENT BUG: the cleaning and service fees are reported but excluded from the total', () => {
    const { breakdown } = quoteStay(input({ site: site({ site_type: 'cabin' }) }))
    // Both are populated for display...
    expect(breakdown.cleaningFee).toBeGreaterThan(0)
    expect(breakdown.serviceFee).toBeGreaterThan(0)
    // ...but neither reaches the total. S-0.6 charges configured fees instead.
    expect(breakdown.total).toBe(
      (breakdown.subtotal ?? 0) + Math.round((breakdown.subtotal ?? 0) * TAX_RATE),
    )
  })

  test('PINS CURRENT BUG: an unset tax rate falls back to a hardcoded rate', () => {
    const { breakdown } = quoteStay(input({ property: property({ pricing_config: {} }) }))
    expect(breakdown.tax_rate).toBe(LEGACY_DEFAULT_TAX_RATE)
  })
})

describe('quoteStay line items', () => {
  test('emits a base line whose amount is the stay subtotal', () => {
    const { lineItems } = quoteStay(input())
    expect(lineItems.filter((l) => l.category === 'base')).toEqual([
      {
        description: expect.any(String),
        category: 'base',
        quantity: 3,
        unitPrice: NIGHTLY_CENTS,
        amount: NIGHTLY_CENTS * 3,
      },
    ])
  })

  test('emits a tax line matching the breakdown tax', () => {
    const { breakdown, lineItems } = quoteStay(input())
    const taxLines = lineItems.filter((l) => l.category === 'tax')
    expect(taxLines.map((l) => l.amount)).toEqual([breakdown.taxes])
  })

  test('emits no tax line when the property charges no tax', () => {
    const { lineItems } = quoteStay(
      input({ property: property({ pricing_config: { tax_rate: 0 } }) }),
    )
    expect(lineItems.filter((l) => l.category === 'tax')).toEqual([])
  })

  test('emits a fee line for a pet fee', () => {
    const { lineItems } = quoteStay(
      input({
        numPets: 1,
        property: property({ pricing_config: { tax_rate: TAX_RATE, pet_fee_cents: PET_FEE_CENTS } }),
      }),
    )
    expect(lineItems.filter((l) => l.category === 'fee').map((l) => l.amount)).toEqual([
      PET_FEE_CENTS,
    ])
  })

  test('emits a discount line as a positive magnitude, the sign carried by the category', () => {
    const FLAT_DISCOUNT = 20_00
    const { lineItems } = quoteStay(
      input({
        property: property({
          rate_discounts_config: {
            user_defined_discounts: [
              {
                id: 'd-4',
                title: 'Promo',
                enabled: true,
                trigger_type: 'min_nights',
                trigger_conditions: { min_nights: 1 },
                discount_type: 'flat_amount',
                value_cents: FLAT_DISCOUNT,
              },
            ],
          },
        }),
      }),
    )
    expect(lineItems.filter((l) => l.category === 'discount').map((l) => l.amount)).toEqual([
      FLAT_DISCOUNT,
    ])
  })

  test('line items reconcile to the breakdown total: base + fees + tax - discounts', () => {
    const FLAT_DISCOUNT = 10_00
    const result = quoteStay(
      input({
        numPets: 1,
        property: property({
          pricing_config: { tax_rate: TAX_RATE, pet_fee_cents: PET_FEE_CENTS },
          rate_discounts_config: {
            user_defined_discounts: [
              {
                id: 'd-5',
                title: 'Promo',
                enabled: true,
                trigger_type: 'min_nights',
                trigger_conditions: { min_nights: 1 },
                discount_type: 'flat_amount',
                value_cents: FLAT_DISCOUNT,
              },
            ],
          },
        }),
      }),
    )
    const signed = result.lineItems.reduce(
      (sum, l) => (l.category === 'discount' ? sum - l.amount : sum + l.amount),
      0,
    )
    expect(signed).toBe(result.breakdown.total)
  })
})

describe('quoteStay rates', () => {
  test('exposes the effective nightly rate, which deposit rules need', () => {
    expect(quoteStay(input()).rates.nightlyCents).toBe(NIGHTLY_CENTS)
  })

  test('resolves the nightly rate from the property reservation-type config when the site is not manual', () => {
    const PROPERTY_NIGHTLY = 60_00
    const result = quoteStay(
      input({
        site: site({ pricing_override: null, enabled_reservation_types_override: null }),
        property: property({
          reservation_type_config: {
            nightly: { enabled: true, min_nights: 1, max_nights: 6, rate_cents: PROPERTY_NIGHTLY },
            weekly: { enabled: false, min_nights: 7, max_nights: 27, rate_cents: null },
            monthly: { enabled: false, min_nights: 28, max_nights: null, rate_cents: null },
            seasonal: { enabled: false, min_nights: 1, max_nights: null, rate_cents: null, flat_rate: true },
          },
        }),
      }),
    )
    expect(result.rates.nightlyCents).toBe(PROPERTY_NIGHTLY)
    expect(result.breakdown.subtotal).toBe(PROPERTY_NIGHTLY * 3)
  })
})

describe('quoteStay rate-period thresholds (S-0.4)', () => {
  const THIRTY_NIGHT_MONTH = 30
  const MONTHLY_CENTS = 900_00

  const monthlyProperty = (monthlyMinNights: number) =>
    property({
      enabled_reservation_types: ['nightly', 'weekly', 'monthly'],
      reservation_type_config: {
        nightly: { enabled: true, min_nights: 1, max_nights: 6, rate_cents: null },
        weekly: { enabled: true, min_nights: 7, max_nights: monthlyMinNights - 1, rate_cents: null },
        monthly: { enabled: true, min_nights: monthlyMinNights, max_nights: null, rate_cents: null },
        seasonal: { enabled: false, min_nights: 1, max_nights: null, rate_cents: null, flat_rate: true },
      },
    })

  const monthlySite = site({
    monthly_rate_cents: MONTHLY_CENTS,
    enabled_reservation_types_override: ['nightly', 'weekly', 'monthly'],
  })

  test('bills a 30-night stay monthly when the property defines a month as 30 nights', () => {
    const { breakdown } = quoteStay(
      input({
        numberOfNights: THIRTY_NIGHT_MONTH,
        checkOutDate: '2026-07-15',
        site: monthlySite,
        property: monthlyProperty(THIRTY_NIGHT_MONTH),
      }),
    )
    expect(breakdown.rate_type).toBe('monthly')
    expect(breakdown.subtotal).toBe(MONTHLY_CENTS)
  })

  test('bills 29 nights as weeks plus nights under the same configuration', () => {
    const { breakdown } = quoteStay(
      input({
        numberOfNights: THIRTY_NIGHT_MONTH - 1,
        checkOutDate: '2026-07-14',
        site: monthlySite,
        property: monthlyProperty(THIRTY_NIGHT_MONTH),
      }),
    )
    expect(breakdown.rate_type).not.toBe('monthly')
  })

  test('bills a 28-night stay monthly when the property keeps the 28-night default', () => {
    const { breakdown } = quoteStay(
      input({
        numberOfNights: 28,
        checkOutDate: '2026-07-13',
        site: monthlySite,
        property: monthlyProperty(28),
      }),
    )
    expect(breakdown.rate_type).toBe('monthly')
    expect(breakdown.subtotal).toBe(MONTHLY_CENTS)
  })
})

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
import type { TaxDefinition } from '@/lib/config/tax-rules'

const NIGHTLY_CENTS = 45_00
const WEEKLY_CENTS = 270_00
const PET_FEE_CENTS = 15_00
const TAX_RATE = 0.07
const CHECK_IN = '2026-06-15'

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
  // No property_taxes rows: these cases exercise the legacy pricing_config
  // rate, which quoteStay still bridges until the migration is applied
  // everywhere. The multi-tax cases pass their own list.
  taxes: [],
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

  // --- S-0.6: hardcoded fees and the tax fallback are gone ---

  test('charges no fee for a cabin unless the property configured one', () => {
    const { breakdown } = quoteStay(input({ site: site({ site_type: 'cabin' }) }))
    expect(breakdown.user_fees ?? []).toEqual([])
    expect(breakdown.total).toBe(
      (breakdown.subtotal ?? 0) + Math.round((breakdown.subtotal ?? 0) * TAX_RATE),
    )
  })

  test('charges no tax when the property has no rate configured, rather than assuming one', () => {
    const { breakdown } = quoteStay(input({ property: property({ pricing_config: {} }) }))
    expect(breakdown.tax_rate).toBe(0)
    expect(breakdown.taxes).toBe(0)
    expect(breakdown.total).toBe(breakdown.subtotal)
  })
})

describe('quoteStay configured fees (S-0.6)', () => {
  const CLEANING_CENTS = 50_00
  const RESORT_FEE_CENTS = 10_00

  const feeProperty = (fees: unknown[]) =>
    property({ pricing_config: { tax_rate: TAX_RATE, user_defined_fees: fees } })

  const cleaningFee = (over: Record<string, unknown> = {}) => ({
    id: 'fee-cleaning',
    title: 'Cleaning Fee',
    fee_type: 'flat_amount',
    value_cents: CLEANING_CENTS,
    is_taxable: true,
    trigger_type: 'always',
    display_order: 0,
    enabled: true,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  })

  test('applies an always-on configured fee and includes it in the total', () => {
    const { breakdown } = quoteStay(input({ property: feeProperty([cleaningFee()]) }))
    const subtotal = NIGHTLY_CENTS * 3
    const expectedTax = Math.round((subtotal + CLEANING_CENTS) * TAX_RATE)
    expect(breakdown.user_fees).toEqual([
      { id: 'fee-cleaning', title: 'Cleaning Fee', amount: CLEANING_CENTS, is_taxable: true },
    ])
    expect(breakdown.total).toBe(subtotal + CLEANING_CENTS + expectedTax)
  })

  test('honours site-type scoping, so a cabin fee does not apply to an RV site', () => {
    const scoped = cleaningFee({ applies_to_site_types: ['cabin'] })
    const rvQuote = quoteStay(input({ property: feeProperty([scoped]) }))
    expect(rvQuote.breakdown.user_fees ?? []).toEqual([])

    const cabinQuote = quoteStay(
      input({ site: site({ site_type: 'cabin' }), property: feeProperty([scoped]) }),
    )
    expect(cabinQuote.breakdown.user_fees).toHaveLength(1)
  })

  test('excludes a non-taxable fee from the taxable base but still charges it', () => {
    const nonTaxable = cleaningFee({ is_taxable: false })
    const { breakdown } = quoteStay(input({ property: feeProperty([nonTaxable]) }))
    const subtotal = NIGHTLY_CENTS * 3
    expect(breakdown.taxes).toBe(Math.round(subtotal * TAX_RATE))
    expect(breakdown.total).toBe(subtotal + CLEANING_CENTS + Math.round(subtotal * TAX_RATE))
  })

  test('does not apply a manual fee, which a guest cannot select', () => {
    const { breakdown } = quoteStay(
      input({ property: feeProperty([cleaningFee({ trigger_type: 'manual' })]) }),
    )
    expect(breakdown.user_fees ?? []).toEqual([])
  })

  test('does not apply a disabled fee', () => {
    const { breakdown } = quoteStay(
      input({ property: feeProperty([cleaningFee({ enabled: false })]) }),
    )
    expect(breakdown.user_fees ?? []).toEqual([])
  })

  test('applies a per-night fee once per night', () => {
    const perNight = cleaningFee({
      id: 'fee-resort',
      title: 'Resort Fee',
      fee_type: 'per_night',
      value_cents: RESORT_FEE_CENTS,
    })
    const { breakdown } = quoteStay(input({ property: feeProperty([perNight]) }))
    expect(breakdown.user_fees?.[0]?.amount).toBe(RESORT_FEE_CENTS * 3)
  })

  test('taxes the post-discount subtotal plus taxable fees', () => {
    const FLAT_DISCOUNT = 20_00
    const { breakdown } = quoteStay(
      input({
        property: property({
          pricing_config: { tax_rate: TAX_RATE, user_defined_fees: [cleaningFee()] },
          rate_discounts_config: {
            user_defined_discounts: [
              {
                id: 'd-fee',
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
    const subtotal = NIGHTLY_CENTS * 3
    expect(breakdown.taxes).toBe(
      Math.round((subtotal + CLEANING_CENTS - FLAT_DISCOUNT) * TAX_RATE),
    )
  })

  test('taxes the pre-discount amount when the property turns that setting off', () => {
    const FLAT_DISCOUNT = 20_00
    const { breakdown } = quoteStay(
      input({
        property: property({
          pricing_config: {
            tax_rate: TAX_RATE,
            discounts_reduce_taxable_amount: false,
            user_defined_fees: [],
          },
          rate_discounts_config: {
            user_defined_discounts: [
              {
                id: 'd-nored',
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
    expect(breakdown.taxes).toBe(Math.round(NIGHTLY_CENTS * 3 * TAX_RATE))
  })

  test('emits a fee line item per configured fee', () => {
    const { lineItems } = quoteStay(input({ property: feeProperty([cleaningFee()]) }))
    expect(lineItems.filter((l) => l.category === 'fee').map((l) => l.description)).toEqual([
      'Cleaning Fee',
    ])
  })

  test('line items still reconcile to the total with fees applied', () => {
    const result = quoteStay(
      input({ numPets: 1, property: feeProperty([cleaningFee()]) }),
    )
    const signed = result.lineItems.reduce(
      (sum, l) => (l.category === 'discount' ? sum - l.amount : sum + l.amount),
      0,
    )
    expect(signed).toBe(result.breakdown.total)
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

describe('quoteStay pet fee is charged once', () => {
  const PET_CENTS = 15_00

  test('a configured has_pets fee appears as pet_fee and not also as a user fee', () => {
    const { breakdown } = quoteStay(
      input({
        numPets: 1,
        property: property({
          pricing_config: {
            tax_rate: TAX_RATE,
            user_defined_fees: [
              {
                id: 'fee-pet',
                title: 'Pet Fee',
                fee_type: 'flat_amount',
                value_cents: PET_CENTS,
                is_taxable: true,
                trigger_type: 'has_pets',
                display_order: 0,
                enabled: true,
                created_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        }),
      }),
    )
    expect(breakdown.pet_fee).toBe(PET_CENTS)
    expect(breakdown.user_fees ?? []).toEqual([])
    expect(breakdown.total).toBe(
      NIGHTLY_CENTS * 3 + Math.round(NIGHTLY_CENTS * 3 * TAX_RATE) + PET_CENTS,
    )
  })

  test('a pet fee and a separate always-on fee are both charged, once each', () => {
    const CLEAN_CENTS = 50_00
    const { breakdown } = quoteStay(
      input({
        numPets: 1,
        property: property({
          pricing_config: {
            tax_rate: TAX_RATE,
            user_defined_fees: [
              {
                id: 'fee-pet',
                title: 'Pet Fee',
                fee_type: 'flat_amount',
                value_cents: PET_CENTS,
                is_taxable: true,
                trigger_type: 'has_pets',
                display_order: 0,
                enabled: true,
                created_at: '2026-01-01T00:00:00Z',
              },
              {
                id: 'fee-clean',
                title: 'Cleaning Fee',
                fee_type: 'flat_amount',
                value_cents: CLEAN_CENTS,
                is_taxable: true,
                trigger_type: 'always',
                display_order: 1,
                enabled: true,
                created_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        }),
      }),
    )
    expect(breakdown.pet_fee).toBe(PET_CENTS)
    expect(breakdown.user_fees?.map((f) => f.id)).toEqual(['fee-clean'])
    const subtotal = NIGHTLY_CENTS * 3
    expect(breakdown.total).toBe(
      subtotal + CLEAN_CENTS + Math.round((subtotal + CLEAN_CENTS) * TAX_RATE) + PET_CENTS,
    )
  })
})

// ============================================================================
// S-3.4 — tax as a list of lines
//
// A property can owe a state, county and city tax at once, each remitted
// separately, and Ohio exempts a stay of 30 nights or more from its lodging
// tax. These cases pin what the quote does with property_taxes rows, and that
// the legacy single rate still works until the migration is everywhere.
// ============================================================================

const STATE_RATE_BP = 575 // 5.75%
const COUNTY_RATE_BP = 300 // 3.00%
const OHIO_MAX_NIGHTS = 29 // Ohio exempts stays of 30 nights or more.

function tax(over: Partial<TaxDefinition> = {}): TaxDefinition {
  return {
    id: 'tax-state',
    name: 'State Lodging Tax',
    authority: 'State Department of Taxation',
    rateType: 'percentage',
    rateBp: STATE_RATE_BP,
    amountCents: null,
    minNights: null,
    maxNights: null,
    basis: 'pre_tax',
    priority: 0,
    discountsReduceTaxableAmount: true,
    exemptible: true,
    effectiveFrom: null,
    effectiveTo: null,
    enabled: true,
    appliesToCategories: ['lodging'],
    ...over,
  }
}

/** A property that carries no legacy rate, so only property_taxes rows apply. */
const noLegacyRate = () => property({ pricing_config: {} })

describe('quoteStay tax lines', () => {
  const subtotal = NIGHTLY_CENTS * 3

  test('charges each configured tax as its own line, and totals them', () => {
    const county = tax({
      id: 'tax-county',
      name: 'County Lodging Tax',
      authority: 'Ashtabula County',
      rateBp: COUNTY_RATE_BP,
      priority: 1,
    })
    const { breakdown } = quoteStay(
      input({ property: noLegacyRate(), taxes: [tax(), county] }),
    )

    const stateAmount = Math.round((subtotal * STATE_RATE_BP) / 10_000)
    const countyAmount = Math.round((subtotal * COUNTY_RATE_BP) / 10_000)
    expect({
      lines: breakdown.tax_lines,
      taxes: breakdown.taxes,
      total: breakdown.total,
    }).toEqual({
      lines: [
        {
          tax_id: 'tax-state',
          name: 'State Lodging Tax',
          authority: 'State Department of Taxation',
          rate_bp: STATE_RATE_BP,
          amount_cents: stateAmount,
          exempt: false,
        },
        {
          tax_id: 'tax-county',
          name: 'County Lodging Tax',
          authority: 'Ashtabula County',
          rate_bp: COUNTY_RATE_BP,
          amount_cents: countyAmount,
          exempt: false,
        },
      ],
      taxes: stateAmount + countyAmount,
      total: subtotal + stateAmount + countyAmount,
    })
  })

  test('emits one tax line item per authority, labelled with it', () => {
    const county = tax({
      id: 'tax-county',
      name: 'County Lodging Tax',
      authority: 'Ashtabula County',
      rateBp: COUNTY_RATE_BP,
      priority: 1,
    })
    const { lineItems } = quoteStay(input({ property: noLegacyRate(), taxes: [tax(), county] }))

    expect(lineItems.filter((l) => l.category === 'tax').map((l) => l.description)).toEqual([
      'State Lodging Tax (State Department of Taxation)',
      'County Lodging Tax (Ashtabula County)',
    ])
  })

  test('reports no single rate when several taxes apply, rather than passing one off as the whole', () => {
    const county = tax({ id: 'tax-county', rateBp: COUNTY_RATE_BP, priority: 1 })
    const { breakdown } = quoteStay(input({ property: noLegacyRate(), taxes: [tax(), county] }))
    expect({ name: breakdown.tax_name, rate: breakdown.tax_rate }).toEqual({
      name: 'Taxes',
      rate: undefined,
    })
  })

  test('still reports the rate and name when exactly one tax applies', () => {
    const { breakdown } = quoteStay(input({ property: noLegacyRate(), taxes: [tax()] }))
    expect({ name: breakdown.tax_name, rate: breakdown.tax_rate }).toEqual({
      name: 'State Lodging Tax',
      rate: STATE_RATE_BP / 10_000,
    })
  })

  test('drops the tax entirely for a stay past the configured duration gate', () => {
    // The Ohio shape: a 35-night stay owes no lodging tax at all.
    const { breakdown, lineItems } = quoteStay(
      input({
        property: noLegacyRate(),
        taxes: [tax({ maxNights: OHIO_MAX_NIGHTS })],
        numberOfNights: OHIO_MAX_NIGHTS + 6,
        checkOutDate: '2026-07-20',
      }),
    )
    expect({
      lines: breakdown.tax_lines,
      taxes: breakdown.taxes,
      taxItems: lineItems.filter((l) => l.category === 'tax'),
    }).toEqual({ lines: [], taxes: 0, taxItems: [] })
  })

  test('charges that same tax on a stay inside the gate', () => {
    const { breakdown } = quoteStay(
      input({ property: noLegacyRate(), taxes: [tax({ maxNights: OHIO_MAX_NIGHTS })] }),
    )
    expect(breakdown.taxes).toBe(Math.round((subtotal * STATE_RATE_BP) / 10_000))
  })

  test('taxes at the rate effective on the check-in date, not the rate in force elsewhere', () => {
    const expired = tax({ id: 'tax-old', effectiveTo: '2026-05-31' })
    const current = tax({ id: 'tax-new', rateBp: COUNTY_RATE_BP, effectiveFrom: '2026-06-01' })
    const { breakdown } = quoteStay(
      input({ property: noLegacyRate(), taxes: [expired, current] }),
    )
    expect(breakdown.tax_lines?.map((l) => l.tax_id)).toEqual(['tax-new'])
  })

  test('ignores a disabled tax', () => {
    const { breakdown } = quoteStay(
      input({ property: noLegacyRate(), taxes: [tax({ enabled: false })] }),
    )
    expect({ lines: breakdown.tax_lines, taxes: breakdown.taxes }).toEqual({
      lines: [],
      taxes: 0,
    })
  })

  test('charges a per_night tax once per night, independent of the stay value', () => {
    const BED_TAX_CENTS = 2_00
    const { breakdown } = quoteStay(
      input({
        property: noLegacyRate(),
        taxes: [tax({ rateType: 'per_night', rateBp: null, amountCents: BED_TAX_CENTS })],
      }),
    )
    expect(breakdown.taxes).toBe(BED_TAX_CENTS * 3)
  })

  test('taxes the stay plus only the fees the property marked taxable', () => {
    const TAXABLE_FEE_CENTS = 20_00
    const EXEMPT_FEE_CENTS = 30_00
    const { breakdown } = quoteStay(
      input({
        property: property({
          pricing_config: {
            user_defined_fees: [
              {
                id: 'fee-taxable',
                title: 'Resort fee',
                fee_type: 'flat_amount',
                value_cents: TAXABLE_FEE_CENTS,
                trigger_type: 'always',
                is_taxable: true,
                enabled: true,
              },
              {
                id: 'fee-exempt',
                title: 'Permit',
                fee_type: 'flat_amount',
                value_cents: EXEMPT_FEE_CENTS,
                trigger_type: 'always',
                is_taxable: false,
                enabled: true,
              },
            ],
          },
        }),
        taxes: [tax()],
      }),
    )
    expect(breakdown.taxes).toBe(
      Math.round(((subtotal + TAXABLE_FEE_CENTS) * STATE_RATE_BP) / 10_000),
    )
  })

  test('honours each tax own view of whether a discount reduces its base', () => {
    const DISCOUNT_CENTS = 15_00
    const reduces = tax({ id: 'tax-reduces', discountsReduceTaxableAmount: true })
    const doesNot = tax({ id: 'tax-does-not', discountsReduceTaxableAmount: false, priority: 1 })
    const { breakdown } = quoteStay(
      input({
        property: property({
          pricing_config: {},
          rate_discounts_config: {
            user_defined_discounts: [
              {
                id: 'disc-1',
                title: 'Promo',
                discount_type: 'flat_amount',
                value_cents: DISCOUNT_CENTS,
                trigger_type: 'min_nights',
                trigger_conditions: { min_nights: 1 },
                enabled: true,
              },
            ],
          },
        }),
        taxes: [reduces, doesNot],
      }),
    )
    expect(breakdown.tax_lines?.map((l) => l.amount_cents)).toEqual([
      Math.round(((subtotal - DISCOUNT_CENTS) * STATE_RATE_BP) / 10_000),
      Math.round((subtotal * STATE_RATE_BP) / 10_000),
    ])
  })

  test('falls back to the legacy single rate when no taxes are configured yet', () => {
    // The deployment bridge: code can reach production before the migration,
    // and a property with a rate in pricing_config must keep collecting it.
    const { breakdown } = quoteStay(input({ taxes: [] }))
    expect({
      lines: breakdown.tax_lines?.map((l) => [l.name, l.rate_bp]),
      taxes: breakdown.taxes,
    }).toEqual({
      lines: [['Sales Tax', Math.round(TAX_RATE * 10_000)]],
      taxes: Math.round(subtotal * TAX_RATE),
    })
  })

  test('prefers configured taxes over the legacy rate when both are present', () => {
    const { breakdown } = quoteStay(input({ taxes: [tax()] }))
    expect({
      lines: breakdown.tax_lines?.map((l) => l.tax_id),
      taxes: breakdown.taxes,
    }).toEqual({
      lines: ['tax-state'],
      taxes: Math.round((subtotal * STATE_RATE_BP) / 10_000),
    })
  })
})

/**
 * Shared stay tax assembly.
 *
 * Both server pricing paths use this — the guest quote and reservation
 * creation through QuoteStayQuery, extensions and renewals through
 * pricing-enhanced — so one booking and its later extension charge the same
 * taxes. The cases here pin the mapping onto a PriceBreakdown and the
 * deployment bridge; selection and arithmetic are tested in tax-rules.
 */

import { describe, test, expect } from 'vitest'
import {
  STAY_TAX_CATEGORY,
  applyStayTaxes,
  applyTaxLinesToBreakdown,
  resolveStayTaxes,
} from '../StayTaxLines'
import type { TaxDefinition, TaxLine } from '@/lib/config/tax-rules'
import type { PriceBreakdown } from '@/lib/booking/types'

const STATE_RATE_BP = 575 // 5.75%
const COUNTY_RATE_BP = 300 // 3.00%
const LEGACY_RATE = 0.07 // 7%, as pricing_config stores it
const STAY_CENTS = 300_00
const CHECK_IN = '2026-07-04'
const NIGHTS = 3

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
    appliesToCategories: [STAY_TAX_CATEGORY],
    ...over,
  }
}

const emptyBreakdown = (): PriceBreakdown => ({ subtotal: STAY_CENTS, total: STAY_CENTS })

describe('resolveStayTaxes', () => {
  test('returns the configured taxes when the property has any', () => {
    expect(resolveStayTaxes([tax()], { tax_rate: LEGACY_RATE })).toEqual([tax()])
  })

  test('synthesises one lodging tax from the legacy rate when none are configured', () => {
    // The deployment bridge: code can reach production before the migration,
    // and a property with a rate must keep collecting it.
    expect(resolveStayTaxes([], { tax_rate: LEGACY_RATE, tax_name: 'Sales Tax' })).toEqual([
      {
        id: 'legacy-pricing-config-tax',
        name: 'Sales Tax',
        authority: null,
        rateType: 'percentage',
        rateBp: Math.round(LEGACY_RATE * 10_000),
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
        appliesToCategories: [STAY_TAX_CATEGORY],
      },
    ])
  })

  test('carries the legacy tax base setting onto the synthesised tax', () => {
    const [synthesised] = resolveStayTaxes([], {
      tax_rate: LEGACY_RATE,
      discounts_reduce_taxable_amount: false,
    })
    expect(synthesised?.discountsReduceTaxableAmount).toBe(false)
  })

  test.each([
    ['a rate of zero', { tax_rate: 0 }],
    ['no rate at all', {}],
    ['no pricing config', null],
  ])('charges nothing with %s', (_label, pricingConfig) => {
    expect(resolveStayTaxes([], pricingConfig)).toEqual([])
  })

  test('names the synthesised tax "Tax" when the property left the name blank', () => {
    const [synthesised] = resolveStayTaxes([], { tax_rate: LEGACY_RATE, tax_name: '   ' })
    expect(synthesised?.name).toBe('Tax')
  })
})

describe('applyTaxLinesToBreakdown', () => {
  const line = (over: Partial<TaxLine> = {}): TaxLine => ({
    taxId: 'tax-state',
    name: 'State Lodging Tax',
    authority: 'State Department of Taxation',
    rateBp: STATE_RATE_BP,
    amountCents: 1_725,
    exempt: false,
    ...over,
  })

  test('records each line and returns their total', () => {
    const breakdown = emptyBreakdown()
    const total = applyTaxLinesToBreakdown(breakdown, [
      line(),
      line({ taxId: 'tax-county', rateBp: COUNTY_RATE_BP, amountCents: 900 }),
    ])
    expect([total, breakdown.taxes, breakdown.tax_lines?.length]).toEqual([2_625, 2_625, 2])
  })

  test('reports the rate and name when exactly one tax applies', () => {
    const breakdown = emptyBreakdown()
    applyTaxLinesToBreakdown(breakdown, [line()])
    expect([breakdown.tax_name, breakdown.tax_rate]).toEqual([
      'State Lodging Tax',
      STATE_RATE_BP / 10_000,
    ])
  })

  test('reports no single rate with several taxes, rather than one of them as the whole', () => {
    const breakdown = emptyBreakdown()
    applyTaxLinesToBreakdown(breakdown, [line(), line({ taxId: 'tax-county' })])
    expect([breakdown.tax_name, breakdown.tax_rate]).toEqual(['Taxes', undefined])
  })

  test('reports a zero rate and no lines when nothing is taxed', () => {
    const breakdown = emptyBreakdown()
    const total = applyTaxLinesToBreakdown(breakdown, [])
    expect([total, breakdown.taxes, breakdown.tax_lines, breakdown.tax_rate]).toEqual([
      0,
      0,
      [],
      0,
    ])
  })

  test('omits the rate for a per-night tax, which has none', () => {
    const breakdown = emptyBreakdown()
    applyTaxLinesToBreakdown(breakdown, [line({ rateBp: null, amountCents: 600 })])
    expect([breakdown.tax_name, breakdown.tax_rate]).toEqual(['State Lodging Tax', undefined])
  })
})

describe('applyStayTaxes', () => {
  const args = (over: Partial<Parameters<typeof applyStayTaxes>[0]> = {}) => ({
    breakdown: emptyBreakdown(),
    configuredTaxes: [tax()],
    pricingConfig: {},
    stayPlusTaxableFeesCents: STAY_CENTS,
    discountCents: 0,
    numberOfNights: NIGHTS,
    checkInDate: CHECK_IN,
    ...over,
  })

  test('charges the configured taxes on the stay and records them', () => {
    const input = args()
    const { taxes } = applyStayTaxes(input)
    expect([taxes, input.breakdown.taxes]).toEqual([
      Math.round((STAY_CENTS * STATE_RATE_BP) / 10_000),
      Math.round((STAY_CENTS * STATE_RATE_BP) / 10_000),
    ])
  })

  test('drops a tax whose duration gate the stay is past', () => {
    const OHIO_MAX_NIGHTS = 29
    const { taxes } = applyStayTaxes(
      args({
        configuredTaxes: [tax({ maxNights: OHIO_MAX_NIGHTS })],
        numberOfNights: OHIO_MAX_NIGHTS + 1,
      }),
    )
    expect(taxes).toBe(0)
  })

  test('taxes against the check-in date, so a future stay gets the rate effective then', () => {
    const nextSeason = tax({ id: 'tax-next', rateBp: COUNTY_RATE_BP, effectiveFrom: '2026-07-01' })
    const thisSeason = tax({ id: 'tax-now', effectiveTo: '2026-06-30' })
    const { taxLines } = applyStayTaxes(
      args({ configuredTaxes: [thisSeason, nextSeason] }),
    )
    expect(taxLines.map((l) => l.taxId)).toEqual(['tax-next'])
  })
})

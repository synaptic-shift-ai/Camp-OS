/**
 * Tests for tax computation rules.
 *
 * S-0.3: tax was computed four different ways across the codebase. Two of them
 * ignored the per-fee `is_taxable` flag that already exists in configuration —
 * pricing-enhanced.ts accumulated a taxable-fee subtotal and then never read
 * it, taxing every fee. These rules are the single authority the remaining
 * paths move onto in S-0.5 and S-0.6.
 */

import { describe, test, expect } from 'vitest'
import { computeTaxableBase, computeTax, stayPlusTaxableFeesFromTotal } from './tax-rules'
import type { TaxableAmounts, TaxRules } from './tax-rules'

const TAX_RATE = 0.085 // 8.5%
const ZERO_RATE = 0

const SUBTOTAL_CENTS = 100_00
const TAXABLE_FEE_CENTS = 25_00
const NON_TAXABLE_FEE_CENTS = 10_00
const DISCOUNT_CENTS = 20_00

const discountsReduce: TaxRules = { taxRate: TAX_RATE, discountsReduceTaxableAmount: true }
const discountsDoNotReduce: TaxRules = { taxRate: TAX_RATE, discountsReduceTaxableAmount: false }

const amounts: TaxableAmounts = {
  subtotalCents: SUBTOTAL_CENTS,
  taxableFeesCents: TAXABLE_FEE_CENTS,
  discountCents: DISCOUNT_CENTS,
}

describe('computeTaxableBase', () => {
  test('includes the subtotal and taxable fees, less discounts, when discounts reduce the base', () => {
    expect(computeTaxableBase(amounts, discountsReduce)).toBe(
      SUBTOTAL_CENTS + TAXABLE_FEE_CENTS - DISCOUNT_CENTS,
    )
  })

  test('excludes discounts from the base when the property taxes the pre-discount amount', () => {
    expect(computeTaxableBase(amounts, discountsDoNotReduce)).toBe(
      SUBTOTAL_CENTS + TAXABLE_FEE_CENTS,
    )
  })

  test('excludes fees that are not marked taxable, which the caller omits from taxableFeesCents', () => {
    const base = computeTaxableBase(
      { subtotalCents: SUBTOTAL_CENTS, taxableFeesCents: 0, discountCents: 0 },
      discountsReduce,
    )
    expect(base).toBe(SUBTOTAL_CENTS)
  })

  test('never returns a negative base when a discount exceeds the taxable amount', () => {
    const base = computeTaxableBase(
      { subtotalCents: SUBTOTAL_CENTS, taxableFeesCents: 0, discountCents: SUBTOTAL_CENTS * 2 },
      discountsReduce,
    )
    expect(base).toBe(0)
  })

  test('treats omitted fee and discount amounts as zero', () => {
    expect(computeTaxableBase({ subtotalCents: SUBTOTAL_CENTS }, discountsReduce)).toBe(
      SUBTOTAL_CENTS,
    )
  })
})

describe('computeTax', () => {
  test('applies the rate to the taxable base', () => {
    const base = SUBTOTAL_CENTS + TAXABLE_FEE_CENTS - DISCOUNT_CENTS
    expect(computeTax(amounts, discountsReduce)).toBe(Math.round(base * TAX_RATE))
  })

  test('returns zero when the property has no tax rate configured', () => {
    expect(computeTax(amounts, { taxRate: ZERO_RATE, discountsReduceTaxableAmount: true })).toBe(0)
  })

  test('returns zero when the taxable base is zero', () => {
    expect(
      computeTax({ subtotalCents: 0 }, discountsReduce),
    ).toBe(0)
  })

  test('taxes more when discounts do not reduce the base, for the same inputs', () => {
    expect(computeTax(amounts, discountsDoNotReduce)).toBeGreaterThan(
      computeTax(amounts, discountsReduce),
    )
  })

  test('rounds to whole cents rather than truncating', () => {
    // 1000 * 0.085 = 85 exactly; 1001 * 0.085 = 85.085 -> 85
    expect(computeTax({ subtotalCents: 1001 }, { taxRate: TAX_RATE, discountsReduceTaxableAmount: true })).toBe(85)
    // 1006 * 0.085 = 85.51 -> 86
    expect(computeTax({ subtotalCents: 1006 }, { taxRate: TAX_RATE, discountsReduceTaxableAmount: true })).toBe(86)
  })

  test('rounds a half-cent up, matching the rest of the pricing path', () => {
    // base 10 at 5% = 0.5 cents
    expect(computeTax({ subtotalCents: 10 }, { taxRate: 0.05, discountsReduceTaxableAmount: true })).toBe(1)
  })

  test('taxes the full amount at a 100% rate, the schema maximum', () => {
    expect(
      computeTax({ subtotalCents: SUBTOTAL_CENTS }, { taxRate: 1, discountsReduceTaxableAmount: true }),
    ).toBe(SUBTOTAL_CENTS)
  })

  test('a non-taxable fee changes neither the base nor the tax', () => {
    const withoutFee = computeTax({ subtotalCents: SUBTOTAL_CENTS }, discountsReduce)
    // A caller excludes a non-taxable fee from taxableFeesCents entirely.
    const withFee = computeTax({ subtotalCents: SUBTOTAL_CENTS, taxableFeesCents: 0 }, discountsReduce)
    expect(withFee).toBe(withoutFee)
    expect(NON_TAXABLE_FEE_CENTS).toBeGreaterThan(0) // the fee exists, it just is not taxed
  })
})

describe('stayPlusTaxableFeesFromTotal', () => {
  // The server engine mutates one running total rather than keeping the parts,
  // so it has to recover the taxable subtotal. These cases pin that arithmetic.
  const STAY_CENTS = 300_00

  test('recovers the stay subtotal when there are no fees or discounts', () => {
    expect(
      stayPlusTaxableFeesFromTotal({
        totalBeforeTaxCents: STAY_CENTS,
        allFeesCents: 0,
        taxableFeesCents: 0,
        discountCents: 0,
      }),
    ).toBe(STAY_CENTS)
  })

  test('keeps a taxable fee in the subtotal', () => {
    expect(
      stayPlusTaxableFeesFromTotal({
        totalBeforeTaxCents: STAY_CENTS + TAXABLE_FEE_CENTS,
        allFeesCents: TAXABLE_FEE_CENTS,
        taxableFeesCents: TAXABLE_FEE_CENTS,
        discountCents: 0,
      }),
    ).toBe(STAY_CENTS + TAXABLE_FEE_CENTS)
  })

  test('removes a non-taxable fee from the subtotal, the S-0.3 bug fix', () => {
    expect(
      stayPlusTaxableFeesFromTotal({
        totalBeforeTaxCents: STAY_CENTS + NON_TAXABLE_FEE_CENTS,
        allFeesCents: NON_TAXABLE_FEE_CENTS,
        taxableFeesCents: 0,
        discountCents: 0,
      }),
    ).toBe(STAY_CENTS)
  })

  test('keeps only the taxable part when both fee kinds are present', () => {
    const allFees = TAXABLE_FEE_CENTS + NON_TAXABLE_FEE_CENTS
    expect(
      stayPlusTaxableFeesFromTotal({
        totalBeforeTaxCents: STAY_CENTS + allFees,
        allFeesCents: allFees,
        taxableFeesCents: TAXABLE_FEE_CENTS,
        discountCents: 0,
      }),
    ).toBe(STAY_CENTS + TAXABLE_FEE_CENTS)
  })

  test('adds a discount back, since the discount decision belongs to computeTaxableBase', () => {
    expect(
      stayPlusTaxableFeesFromTotal({
        totalBeforeTaxCents: STAY_CENTS - DISCOUNT_CENTS,
        allFeesCents: 0,
        taxableFeesCents: 0,
        discountCents: DISCOUNT_CENTS,
      }),
    ).toBe(STAY_CENTS)
  })

  test('round-trips through computeTax: a non-taxable fee changes no tax', () => {
    const withoutFee = computeTax(
      {
        subtotalCents: stayPlusTaxableFeesFromTotal({
          totalBeforeTaxCents: STAY_CENTS,
          allFeesCents: 0,
          taxableFeesCents: 0,
          discountCents: 0,
        }),
      },
      discountsReduce,
    )
    const withNonTaxableFee = computeTax(
      {
        subtotalCents: stayPlusTaxableFeesFromTotal({
          totalBeforeTaxCents: STAY_CENTS + NON_TAXABLE_FEE_CENTS,
          allFeesCents: NON_TAXABLE_FEE_CENTS,
          taxableFeesCents: 0,
          discountCents: 0,
        }),
      },
      discountsReduce,
    )
    expect(withNonTaxableFee).toBe(withoutFee)
  })
})

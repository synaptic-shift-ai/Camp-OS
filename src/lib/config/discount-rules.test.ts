/**
 * Tests for discount amount calculation.
 *
 * S-0.7: `percentage_of_total` was computed against the stay subtotal in three
 * places, making it identical to `percentage_of_subtotal` despite the type
 * meaning "percentage of total including fees". The switch lived in three
 * engines, so the bug had to be fixed three times — it lives here now.
 */

import { describe, test, expect } from 'vitest'
import { computeDiscountAmount } from './discount-rules'
import type { UserDefinedDiscount } from './types'

const SUBTOTAL = 300_00
const FEES = 50_00
const TOTAL_BASE = SUBTOTAL + FEES
const PCT = 10
const FLAT_CENTS = 25_00

const baseDiscount: UserDefinedDiscount = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Promo',
  discount_type: 'flat_amount',
  value_cents: FLAT_CENTS,
  trigger_type: 'manual',
  display_order: 0,
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
}

const { value_cents: _unusedCents, ...discountWithoutCents } = baseDiscount

const context = { subtotalCents: SUBTOTAL, totalBaseCents: TOTAL_BASE }

describe('computeDiscountAmount', () => {
  test('flat_amount discounts the configured cents', () => {
    expect(computeDiscountAmount(baseDiscount, context)).toBe(FLAT_CENTS)
  })

  test('percentage_of_subtotal discounts a percentage of the stay subtotal', () => {
    expect(
      computeDiscountAmount(
        { ...discountWithoutCents, discount_type: 'percentage_of_subtotal', value_percentage: PCT },
        context,
      ),
    ).toBe(Math.round(SUBTOTAL * PCT / 100))
  })

  test('percentage_of_total discounts a percentage of the fee-inclusive base', () => {
    expect(
      computeDiscountAmount(
        { ...discountWithoutCents, discount_type: 'percentage_of_total', value_percentage: PCT },
        context,
      ),
    ).toBe(Math.round(TOTAL_BASE * PCT / 100))
  })

  test('percentage_of_total and percentage_of_subtotal differ once fees exist', () => {
    const ofTotal = computeDiscountAmount(
      { ...discountWithoutCents, discount_type: 'percentage_of_total', value_percentage: PCT },
      context,
    )
    const ofSubtotal = computeDiscountAmount(
      { ...discountWithoutCents, discount_type: 'percentage_of_subtotal', value_percentage: PCT },
      context,
    )
    expect(ofTotal).toBeGreaterThan(ofSubtotal)
  })

  test('the two agree when there are no fees, since the bases coincide', () => {
    const noFees = { subtotalCents: SUBTOTAL, totalBaseCents: SUBTOTAL }
    expect(
      computeDiscountAmount(
        { ...discountWithoutCents, discount_type: 'percentage_of_total', value_percentage: PCT },
        noFees,
      ),
    ).toBe(
      computeDiscountAmount(
        { ...discountWithoutCents, discount_type: 'percentage_of_subtotal', value_percentage: PCT },
        noFees,
      ),
    )
  })

  test('caps the discount at max_discount_cents', () => {
    const CAP = 10_00
    expect(
      computeDiscountAmount(
        {
          ...discountWithoutCents,
          discount_type: 'percentage_of_subtotal',
          value_percentage: 50,
          max_discount_cents: CAP,
        },
        context,
      ),
    ).toBe(CAP)
  })

  test('leaves a discount below the cap untouched', () => {
    const CAP = 100_00
    const expected = Math.round(SUBTOTAL * PCT / 100)
    expect(
      computeDiscountAmount(
        {
          ...discountWithoutCents,
          discount_type: 'percentage_of_subtotal',
          value_percentage: PCT,
          max_discount_cents: CAP,
        },
        context,
      ),
    ).toBe(expected)
  })

  test('ignores a zero cap, which means no cap rather than no discount', () => {
    expect(
      computeDiscountAmount({ ...baseDiscount, max_discount_cents: 0 }, context),
    ).toBe(FLAT_CENTS)
  })

  test('treats a missing value as zero rather than NaN', () => {
    expect(
      computeDiscountAmount({ ...discountWithoutCents, discount_type: 'flat_amount' }, context),
    ).toBe(0)
  })

  test('rounds to whole cents', () => {
    const amount = computeDiscountAmount(
      { ...discountWithoutCents, discount_type: 'percentage_of_subtotal', value_percentage: 3.33 },
      context,
    )
    expect(Number.isInteger(amount)).toBe(true)
    expect(amount).toBe(Math.round(SUBTOTAL * 3.33 / 100))
  })
})

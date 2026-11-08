/**
 * S-0 acceptance invariants for the guest stay quote.
 *
 * S-0 exists because the pricing path hardcoded business data and quoted guests
 * a total it did not charge. These tests pin the two invariants that make that
 * class of defect impossible to reintroduce quietly:
 *
 *   1. A quote is internally consistent: its total equals its parts, and its
 *      line items reconcile to its total, for every configuration.
 *   2. No business value originates in code: an unconfigured property is
 *      charged nothing beyond its stay subtotal.
 *
 * The matrix is generated rather than enumerated, so adding a configuration
 * dimension extends coverage without hand-writing cases. No assertion below
 * references a fee amount, rate or threshold that is not read from the
 * configuration the case was built with.
 */

import { describe, test, expect } from 'vitest'
import { quoteStay, type QuoteStayInput } from '../QuoteStayQuery'
import { computeTax } from '@/lib/config/tax-rules'

const NIGHTLY_CENTS = 45_00
const WEEKLY_CENTS = 270_00
const MONTHLY_CENTS = 900_00
const PET_FEE_CENTS = 15_00

// ---------------------------------------------------------------------------
// Configuration dimensions
// ---------------------------------------------------------------------------

type FeeShape = 'none' | 'taxable_flat' | 'untaxed_flat' | 'per_night' | 'scoped_elsewhere'
type DiscountShape = 'none' | 'flat' | 'pct_subtotal' | 'pct_total'

const FEE_SHAPES: readonly FeeShape[] = [
  'none',
  'taxable_flat',
  'untaxed_flat',
  'per_night',
  'scoped_elsewhere',
]
const DISCOUNT_SHAPES: readonly DiscountShape[] = ['none', 'flat', 'pct_subtotal', 'pct_total']
const TAX_RATES = [0, 0.07] as const
const DISCOUNTS_REDUCE = [true, false] as const
const MONTHLY_MIN_NIGHTS = [28, 30] as const
const STAY_LENGTHS = [3, 7, 28, 30, 34] as const

const FEE_CENTS = 40_00
const FEE_PER_NIGHT_CENTS = 8_00
const DISCOUNT_FLAT_CENTS = 20_00
const DISCOUNT_PCT = 10

const feeFor = (shape: FeeShape) => {
  const common = {
    id: 'fee-1',
    title: 'Configured Fee',
    is_taxable: true,
    trigger_type: 'always' as const,
    display_order: 0,
    enabled: true,
    created_at: '2026-01-01T00:00:00Z',
  }
  switch (shape) {
    case 'none':
      return null
    case 'taxable_flat':
      return { ...common, fee_type: 'flat_amount', value_cents: FEE_CENTS }
    case 'untaxed_flat':
      return { ...common, fee_type: 'flat_amount', value_cents: FEE_CENTS, is_taxable: false }
    case 'per_night':
      return { ...common, fee_type: 'per_night', value_cents: FEE_PER_NIGHT_CENTS }
    case 'scoped_elsewhere':
      // Scoped to a site type the case does not use, so it must not apply.
      return { ...common, fee_type: 'flat_amount', value_cents: FEE_CENTS, applies_to_site_types: ['yurt'] }
  }
}

const discountFor = (shape: DiscountShape) => {
  const common = {
    id: 'disc-1',
    title: 'Configured Discount',
    trigger_type: 'min_nights' as const,
    trigger_conditions: { min_nights: 1 },
    display_order: 0,
    enabled: true,
    created_at: '2026-01-01T00:00:00Z',
  }
  switch (shape) {
    case 'none':
      return null
    case 'flat':
      return { ...common, discount_type: 'flat_amount', value_cents: DISCOUNT_FLAT_CENTS }
    case 'pct_subtotal':
      return { ...common, discount_type: 'percentage_of_subtotal', value_percentage: DISCOUNT_PCT }
    case 'pct_total':
      return { ...common, discount_type: 'percentage_of_total', value_percentage: DISCOUNT_PCT }
  }
}

type Case = {
  name: string
  input: QuoteStayInput
  taxRate: number
  discountsReduce: boolean
}

function buildCase(
  fee: FeeShape,
  discount: DiscountShape,
  taxRate: number,
  discountsReduce: boolean,
  monthlyMin: number,
  nights: number,
  withPet: boolean,
): Case {
  const fees = [feeFor(fee)].filter(Boolean)
  const discounts = [discountFor(discount)].filter(Boolean)

  const input: QuoteStayInput = {
    site: {
      site_type: 'rv',
      base_price: NIGHTLY_CENTS,
      weekly_rate_cents: WEEKLY_CENTS,
      monthly_rate_cents: MONTHLY_CENTS,
      pricing_override: { base_price: NIGHTLY_CENTS },
      enabled_reservation_types_override: ['nightly', 'weekly', 'monthly'],
    },
    property: {
      pricing_config: {
        tax_rate: taxRate,
        tax_name: 'Sales Tax',
        discounts_reduce_taxable_amount: discountsReduce,
        user_defined_fees: fees,
        ...(withPet ? { pet_fee_cents: PET_FEE_CENTS } : {}),
      },
      rate_discounts_config: { user_defined_discounts: discounts },
      reservation_type_config: {
        nightly: { enabled: true, min_nights: 1, max_nights: 6, rate_cents: null },
        weekly: { enabled: true, min_nights: 7, max_nights: monthlyMin - 1, rate_cents: null },
        monthly: { enabled: true, min_nights: monthlyMin, max_nights: null, rate_cents: null },
        seasonal: { enabled: false, min_nights: 1, max_nights: null, rate_cents: null, flat_rate: true },
      },
      site_type_config: null,
      enabled_reservation_types: ['nightly', 'weekly', 'monthly'],
    },
    checkInDate: '2026-06-15',
    checkOutDate: '2026-07-20',
    numberOfNights: nights,
    numAdults: 2,
    numChildren: 1,
    numPets: withPet ? 1 : 0,
  }

  return {
    name: `fee=${fee} discount=${discount} tax=${taxRate} reduce=${discountsReduce} month=${monthlyMin} nights=${nights}${withPet ? ' pet' : ''}`,
    input,
    taxRate,
    discountsReduce,
  }
}

const CASES: Case[] = []
for (const fee of FEE_SHAPES) {
  for (const discount of DISCOUNT_SHAPES) {
    for (const taxRate of TAX_RATES) {
      for (const discountsReduce of DISCOUNTS_REDUCE) {
        for (const monthlyMin of MONTHLY_MIN_NIGHTS) {
          for (const nights of STAY_LENGTHS) {
            CASES.push(
              buildCase(fee, discount, taxRate, discountsReduce, monthlyMin, nights, false),
            )
          }
        }
      }
    }
  }
}
// A pet-bearing variant of each fee shape, since the pet fee has its own field.
for (const fee of FEE_SHAPES) {
  CASES.push(buildCase(fee, 'flat', 0.07, true, 28, 7, true))
}

/**
 * Each invariant is one test over the whole matrix, reporting the exact
 * configurations that violate it. One test per config would inflate the suite
 * count without adding signal.
 */
describe('quoteStay invariants across the configuration matrix', () => {
  const violations = (
    predicate: (c: Case) => boolean,
  ): string[] => CASES.filter((c) => !predicate(c)).map((c) => c.name)

  test('the matrix covers every configuration combination', () => {
    const generated =
      FEE_SHAPES.length *
      DISCOUNT_SHAPES.length *
      TAX_RATES.length *
      DISCOUNTS_REDUCE.length *
      MONTHLY_MIN_NIGHTS.length *
      STAY_LENGTHS.length
    expect(CASES).toHaveLength(generated + FEE_SHAPES.length)
  })

  test('a total always equals the sum of its parts', () => {
    expect(
      violations(({ input }) => {
        const { breakdown } = quoteStay(input)
        const fees = (breakdown.user_fees ?? []).reduce((sum, f) => sum + f.amount, 0)
        const discounts = (breakdown.user_discounts ?? []).reduce((sum, d) => sum + d.amount, 0)
        return (
          breakdown.total ===
          (breakdown.subtotal ?? 0) +
            fees -
            discounts +
            (breakdown.taxes ?? 0) +
            (breakdown.pet_fee ?? 0)
        )
      }),
    ).toEqual([])
  })

  test('line items always reconcile to the total', () => {
    expect(
      violations(({ input }) => {
        const { breakdown, lineItems } = quoteStay(input)
        const signed = lineItems.reduce(
          (sum, l) => (l.category === 'discount' ? sum - l.amount : sum + l.amount),
          0,
        )
        return signed === breakdown.total
      }),
    ).toEqual([])
  })

  test('tax always matches the configured rule applied to the configured base', () => {
    expect(
      violations(({ input, taxRate, discountsReduce }) => {
        const { breakdown } = quoteStay(input)
        const taxableFees = (breakdown.user_fees ?? [])
          .filter((f) => f.is_taxable)
          .reduce((sum, f) => sum + f.amount, 0)
        const discounts = (breakdown.user_discounts ?? []).reduce((sum, d) => sum + d.amount, 0)
        return (
          breakdown.taxes ===
          computeTax(
            {
              subtotalCents: breakdown.subtotal ?? 0,
              taxableFeesCents: taxableFees,
              discountCents: discounts,
            },
            { taxRate, discountsReduceTaxableAmount: discountsReduce },
          )
        )
      }),
    ).toEqual([])
  })

  test('every amount is a non-negative whole number of cents', () => {
    expect(
      violations(({ input }) => {
        const { breakdown, lineItems } = quoteStay(input)
        return [
          breakdown.subtotal ?? 0,
          breakdown.taxes ?? 0,
          breakdown.total ?? 0,
          breakdown.pet_fee ?? 0,
          ...lineItems.map((l) => l.amount),
        ].every((a) => Number.isInteger(a) && a >= 0)
      }),
    ).toEqual([])
  })

  test('no zero-amount line item is emitted', () => {
    expect(
      violations(({ input }) => quoteStay(input).lineItems.every((l) => l.amount !== 0)),
    ).toEqual([])
  })

  test('a fee scoped to another site type is never charged', () => {
    const scoped = CASES.filter((c) => c.name.includes('fee=scoped_elsewhere'))
    expect(scoped.length).toBeGreaterThan(0)
    expect(
      scoped
        .filter(({ input }) => (quoteStay(input).breakdown.user_fees ?? []).length > 0)
        .map((c) => c.name),
    ).toEqual([])
  })
})

describe('an unconfigured property is charged nothing it did not configure', () => {
  const bare: QuoteStayInput = {
    site: {
      site_type: 'rv',
      base_price: NIGHTLY_CENTS,
      weekly_rate_cents: null,
      monthly_rate_cents: null,
      pricing_override: { base_price: NIGHTLY_CENTS },
      enabled_reservation_types_override: ['nightly'],
    },
    property: {
      pricing_config: {},
      rate_discounts_config: null,
      reservation_type_config: null,
      site_type_config: null,
      enabled_reservation_types: ['nightly'],
    },
    checkInDate: '2026-06-15',
    checkOutDate: '2026-06-18',
    numberOfNights: 3,
    numAdults: 2,
    numChildren: 0,
    numPets: 0,
  }

  test('charges the stay subtotal and nothing else', () => {
    const { breakdown } = quoteStay(bare)
    expect(breakdown.total).toBe(NIGHTLY_CENTS * 3)
  })

  test('invents no tax', () => {
    const { breakdown } = quoteStay(bare)
    expect({ rate: breakdown.tax_rate, taxes: breakdown.taxes }).toEqual({ rate: 0, taxes: 0 })
  })

  test('invents no fees or discounts', () => {
    const { breakdown } = quoteStay(bare)
    expect({
      fees: breakdown.user_fees ?? [],
      discounts: breakdown.user_discounts ?? [],
    }).toEqual({ fees: [], discounts: [] })
  })

  test('emits only a base line item', () => {
    const { lineItems } = quoteStay(bare)
    expect(lineItems.map((l) => l.category)).toEqual(['base'])
  })
})

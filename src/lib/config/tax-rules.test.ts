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
import {
  computeTax,
  computeTaxLines,
  computeTaxableBase,
  selectApplicableTaxes,
  stayPlusTaxableFeesFromTotal,
  sumTaxLines,
} from './tax-rules'
import type {
  TaxDefinition,
  TaxExemption,
  TaxLine,
  TaxableAmounts,
  TaxableCharge,
  TaxRules,
} from './tax-rules'

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

// ============================================================================
// S-3.2 — multi-tax selection and tax lines
//
// A single rate per property cannot express the jurisdictions this is sold
// into: Ohio taxes a stay under 30 nights and exempts it at 30 or more,
// Indiana applies a flat rate with no gate, and a state/county/city stack must
// be remitted separately. These cases pin the rules that replace that rate.
// ============================================================================

const STATE_RATE_BP = 575 // 5.75%
const COUNTY_RATE_BP = 300 // 3.00%
const CITY_RATE_BP = 100 // 1.00%

/** Ohio exempts stays of 30 nights or more, so the gate is an inclusive 29. */
const OHIO_MAX_NIGHTS = 29

const CHARGE_DATE = '2026-07-04'
const NIGHTS = 7
const CHARGE_CENTS = 700_00
const CHARGE_DISCOUNT_CENTS = 100_00

const LODGING = 'lodging'
const RETAIL = 'retail'

/** A percentage tax on lodging with no gate and no effective window. */
function lodgingTax(overrides: Partial<TaxDefinition> = {}): TaxDefinition {
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
    appliesToCategories: [LODGING],
    ...overrides,
  }
}

/** A seven-night stay charge, the shape a quote hands in. */
function stayCharge(overrides: Partial<TaxableCharge> = {}): TaxableCharge {
  return {
    categoryCode: LODGING,
    amountCents: CHARGE_CENTS,
    discountCents: CHARGE_DISCOUNT_CENTS,
    nights: NIGHTS,
    chargeDate: CHARGE_DATE,
    ...overrides,
  }
}

/** A store sale: same shape, but with no night count at all. */
function goodsCharge(overrides: Partial<TaxableCharge> = {}): TaxableCharge {
  return {
    categoryCode: RETAIL,
    amountCents: 20_00,
    nights: null,
    chargeDate: CHARGE_DATE,
    ...overrides,
  }
}

const ids = (taxes: readonly TaxDefinition[]) => taxes.map((t) => t.id)

describe('selectApplicableTaxes', () => {
  test('selects a tax whose applicability lists the charge category', () => {
    expect(ids(selectApplicableTaxes([lodgingTax()], stayCharge()))).toEqual(['tax-state'])
  })

  test('omits a tax whose applicability does not list the charge category', () => {
    expect(selectApplicableTaxes([lodgingTax()], stayCharge({ categoryCode: RETAIL }))).toEqual([])
  })

  test('omits a tax with no applicability rows at all', () => {
    expect(selectApplicableTaxes([lodgingTax({ appliesToCategories: [] })], stayCharge())).toEqual(
      [],
    )
  })

  test('omits a disabled tax', () => {
    expect(selectApplicableTaxes([lodgingTax({ enabled: false })], stayCharge())).toEqual([])
  })

  describe('duration gate', () => {
    const ohio = lodgingTax({ maxNights: OHIO_MAX_NIGHTS })

    test.each([
      [OHIO_MAX_NIGHTS - 1, true],
      [OHIO_MAX_NIGHTS, true],
      [OHIO_MAX_NIGHTS + 1, false],
    ])('a %i-night stay is selected by an inclusive max_nights gate: %s', (nights, selected) => {
      expect(selectApplicableTaxes([ohio], stayCharge({ nights })).length).toBe(selected ? 1 : 0)
    })

    test.each([
      [OHIO_MAX_NIGHTS, false],
      [OHIO_MAX_NIGHTS + 1, true],
      [OHIO_MAX_NIGHTS + 2, true],
    ])(
      'a %i-night stay is selected by an inclusive min_nights gate of 30: %s',
      (nights, selected) => {
        const longStayTax = lodgingTax({ minNights: OHIO_MAX_NIGHTS + 1 })
        expect(selectApplicableTaxes([longStayTax], stayCharge({ nights })).length).toBe(
          selected ? 1 : 0,
        )
      },
    )

    test('a tax bounded at both ends selects inside the band and not outside it', () => {
      const banded = lodgingTax({ minNights: 7, maxNights: 13 })
      const selectedAt = (nights: number) =>
        selectApplicableTaxes([banded], stayCharge({ nights })).length === 1
      expect([selectedAt(6), selectedAt(7), selectedAt(13), selectedAt(14)]).toEqual([
        false,
        true,
        true,
        false,
      ])
    })

    test('a gated tax never reaches a charge with no night count', () => {
      // Otherwise Ohio's lodging gate would read as "always applies" on goods.
      const gatedRetail = lodgingTax({
        maxNights: OHIO_MAX_NIGHTS,
        appliesToCategories: [RETAIL],
      })
      expect(selectApplicableTaxes([gatedRetail], goodsCharge())).toEqual([])
    })

    test('an ungated tax of the same category does reach a charge with no night count', () => {
      const retailTax = lodgingTax({ id: 'tax-retail', appliesToCategories: [RETAIL] })
      expect(ids(selectApplicableTaxes([retailTax], goodsCharge()))).toEqual(['tax-retail'])
    })
  })

  describe('effective window', () => {
    const windowed = lodgingTax({ effectiveFrom: '2026-06-01', effectiveTo: '2026-08-31' })

    test.each([
      ['2026-05-31', false],
      ['2026-06-01', true],
      ['2026-07-04', true],
      ['2026-08-31', true],
      ['2026-09-01', false],
    ])('a charge dated %s is selected: %s', (chargeDate, selected) => {
      expect(selectApplicableTaxes([windowed], stayCharge({ chargeDate })).length).toBe(
        selected ? 1 : 0,
      )
    })

    test('an open-ended window selects a charge far in the future', () => {
      const openEnded = lodgingTax({ effectiveFrom: '2026-06-01', effectiveTo: null })
      expect(ids(selectApplicableTaxes([openEnded], stayCharge({ chargeDate: '2099-01-01' })))).toEqual(
        ['tax-state'],
      )
    })
  })

  test('orders pre_tax taxes before compounding ones, then by priority', () => {
    const compounding = lodgingTax({
      id: 'tax-compounding',
      basis: 'compounds_on_tax',
      priority: 0,
    })
    const county = lodgingTax({ id: 'tax-county', rateBp: COUNTY_RATE_BP, priority: 2 })
    const state = lodgingTax({ id: 'tax-state', priority: 1 })
    expect(ids(selectApplicableTaxes([compounding, county, state], stayCharge()))).toEqual([
      'tax-state',
      'tax-county',
      'tax-compounding',
    ])
  })

  test('orders equal-priority taxes by id so the result is stable', () => {
    const b = lodgingTax({ id: 'tax-b' })
    const a = lodgingTax({ id: 'tax-a' })
    expect(ids(selectApplicableTaxes([b, a], stayCharge()))).toEqual(['tax-a', 'tax-b'])
  })
})

describe('computeTaxLines', () => {
  const taxableBase = CHARGE_CENTS - CHARGE_DISCOUNT_CENTS

  test('returns one line carrying the tax identity and the rate it was charged at', () => {
    expect(computeTaxLines([lodgingTax()], stayCharge())).toEqual([
      {
        taxId: 'tax-state',
        name: 'State Lodging Tax',
        authority: 'State Department of Taxation',
        rateBp: STATE_RATE_BP,
        amountCents: Math.round((taxableBase * STATE_RATE_BP) / 10_000),
        exempt: false,
      },
    ])
  })

  test('returns no lines when the stay is past the duration gate', () => {
    const lines = computeTaxLines(
      [lodgingTax({ maxNights: OHIO_MAX_NIGHTS })],
      stayCharge({ nights: OHIO_MAX_NIGHTS + 6 }),
    )
    expect(lines).toEqual([])
  })

  test('taxes the pre-discount amount when the tax does not let discounts reduce its base', () => {
    const lines = computeTaxLines(
      [lodgingTax({ discountsReduceTaxableAmount: false })],
      stayCharge(),
    )
    expect(lines.map((l) => l.amountCents)).toEqual([
      Math.round((CHARGE_CENTS * STATE_RATE_BP) / 10_000),
    ])
  })

  test('floors the base at zero when a discount exceeds the charge', () => {
    const lines = computeTaxLines(
      [lodgingTax()],
      stayCharge({ discountCents: CHARGE_CENTS + 1_00 }),
    )
    expect(lines.map((l) => l.amountCents)).toEqual([0])
  })

  describe('rate types', () => {
    test.each([
      [0, 0],
      [1, Math.round(taxableBase / 10_000)],
      [10_000, taxableBase],
    ])('a %i basis point rate charges %i cents', (rateBp, expected) => {
      expect(computeTaxLines([lodgingTax({ rateBp })], stayCharge())[0]?.amountCents).toBe(expected)
    })

    test('a per_night tax charges its amount once per night, ignoring the charge value', () => {
      const BED_TAX_CENTS = 2_00
      const lines = computeTaxLines(
        [lodgingTax({ rateType: 'per_night', rateBp: null, amountCents: BED_TAX_CENTS })],
        stayCharge(),
      )
      expect(lines.map((l) => ({ amountCents: l.amountCents, rateBp: l.rateBp }))).toEqual([
        { amountCents: BED_TAX_CENTS * NIGHTS, rateBp: null },
      ])
    })

    test('a flat tax charges its amount once, whatever the stay length', () => {
      const LEVY_CENTS = 5_00
      const flat = lodgingTax({ rateType: 'flat', rateBp: null, amountCents: LEVY_CENTS })
      const atNights = (nights: number) =>
        computeTaxLines([flat], stayCharge({ nights }))[0]?.amountCents
      expect([atNights(1), atNights(NIGHTS)]).toEqual([LEVY_CENTS, LEVY_CENTS])
    })

    test('throws rather than under-collecting when a per_night tax reaches a charge with no nights', () => {
      const perNightOnRetail = lodgingTax({
        rateType: 'per_night',
        rateBp: null,
        amountCents: 2_00,
        appliesToCategories: [RETAIL],
      })
      expect(() => computeTaxLines([perNightOnRetail], goodsCharge())).toThrow(
        /per_night.*no night count/i,
      )
    })
  })

  describe('multiple authorities', () => {
    const state = lodgingTax({ id: 'tax-state', authority: 'State', priority: 1 })
    const county = lodgingTax({
      id: 'tax-county',
      authority: 'County',
      rateBp: COUNTY_RATE_BP,
      priority: 2,
    })
    const city = lodgingTax({ id: 'tax-city', authority: 'City', rateBp: CITY_RATE_BP, priority: 3 })

    test('produces one independently remittable line per authority', () => {
      expect(
        computeTaxLines([state, county, city], stayCharge()).map((l) => [
          l.authority,
          l.amountCents,
        ]),
      ).toEqual([
        ['State', Math.round((taxableBase * STATE_RATE_BP) / 10_000)],
        ['County', Math.round((taxableBase * COUNTY_RATE_BP) / 10_000)],
        ['City', Math.round((taxableBase * CITY_RATE_BP) / 10_000)],
      ])
    })

    test('rounds each authority separately rather than rounding one combined rate', () => {
      // 333 cents at 5.75% is 19.1475c and at 3% is 9.99c: 19 + 10 = 29. One
      // combined 8.75% rate would give round(29.1375) = 29 here, so pick an
      // amount where the two genuinely differ.
      const AMOUNT_CENTS = 1_11
      const combinedBp = STATE_RATE_BP + COUNTY_RATE_BP
      const perTax =
        Math.round((AMOUNT_CENTS * STATE_RATE_BP) / 10_000) +
        Math.round((AMOUNT_CENTS * COUNTY_RATE_BP) / 10_000)
      const combined = Math.round((AMOUNT_CENTS * combinedBp) / 10_000)
      // The point of the case: the two approaches disagree, and per-tax wins.
      expect(perTax).not.toBe(combined)
      const lines = computeTaxLines(
        [state, county],
        stayCharge({ amountCents: AMOUNT_CENTS, discountCents: 0 }),
      )
      expect(lines.reduce((sum, l) => sum + l.amountCents, 0)).toBe(perTax)
    })

    test('a pre_tax line is the same whatever order the taxes arrive in', () => {
      const forwards = computeTaxLines([state, county, city], stayCharge())
      const backwards = computeTaxLines([city, county, state], stayCharge())
      expect(backwards).toEqual(forwards)
    })
  })

  describe('compounding', () => {
    test('a compounding tax charges on the charge plus the taxes computed before it', () => {
      const state = lodgingTax({ id: 'tax-state', priority: 1 })
      const compounding = lodgingTax({
        id: 'tax-compounding',
        rateBp: COUNTY_RATE_BP,
        basis: 'compounds_on_tax',
        priority: 2,
      })
      const stateAmount = Math.round((taxableBase * STATE_RATE_BP) / 10_000)
      expect(computeTaxLines([state, compounding], stayCharge()).map((l) => l.amountCents)).toEqual([
        stateAmount,
        Math.round(((taxableBase + stateAmount) * COUNTY_RATE_BP) / 10_000),
      ])
    })

    test('a compounding tax with nothing before it charges on the base alone', () => {
      const only = lodgingTax({ basis: 'compounds_on_tax' })
      expect(computeTaxLines([only], stayCharge())).toEqual(computeTaxLines([lodgingTax()], stayCharge()))
    })
  })

  describe('exemptions', () => {
    const certificate: TaxExemption = { exemptsAll: true, expiresOn: null }

    test('waives an exemptible tax to zero and says so, rather than dropping the line', () => {
      expect(computeTaxLines([lodgingTax()], stayCharge(), certificate)).toEqual([
        {
          taxId: 'tax-state',
          name: 'State Lodging Tax',
          authority: 'State Department of Taxation',
          rateBp: STATE_RATE_BP,
          amountCents: 0,
          exempt: true,
        },
      ])
    })

    test('still charges a tax the property marked non-exemptible', () => {
      const lines = computeTaxLines([lodgingTax({ exemptible: false })], stayCharge(), certificate)
      expect(lines.map((l) => [l.amountCents, l.exempt])).toEqual([
        [Math.round((taxableBase * STATE_RATE_BP) / 10_000), false],
      ])
    })

    test('waives only the named taxes when the certificate is not blanket', () => {
      const county = lodgingTax({ id: 'tax-county', rateBp: COUNTY_RATE_BP, priority: 2 })
      const named: TaxExemption = { exemptsAll: false, taxIds: ['tax-state'] }
      expect(
        computeTaxLines([lodgingTax({ priority: 1 }), county], stayCharge(), named).map((l) => [
          l.taxId,
          l.exempt,
        ]),
      ).toEqual([
        ['tax-state', true],
        ['tax-county', false],
      ])
    })

    test('charges in full when the certificate expired before the charge date', () => {
      const expired: TaxExemption = { exemptsAll: true, expiresOn: '2026-07-03' }
      const lines = computeTaxLines([lodgingTax()], stayCharge(), expired)
      expect(lines.map((l) => l.exempt)).toEqual([false])
    })

    test('still waives when the certificate expires on the charge date itself', () => {
      const expiringToday: TaxExemption = { exemptsAll: true, expiresOn: CHARGE_DATE }
      expect(computeTaxLines([lodgingTax()], stayCharge(), expiringToday).map((l) => l.exempt)).toEqual(
        [true],
      )
    })

    test('a waived tax contributes nothing to a compounding tax computed after it', () => {
      const compounding = lodgingTax({
        id: 'tax-compounding',
        rateBp: COUNTY_RATE_BP,
        basis: 'compounds_on_tax',
        exemptible: false,
        priority: 2,
      })
      const lines = computeTaxLines([lodgingTax({ priority: 1 }), compounding], stayCharge(), certificate)
      expect(lines.map((l) => l.amountCents)).toEqual([
        0,
        Math.round((taxableBase * COUNTY_RATE_BP) / 10_000),
      ])
    })
  })

  test('returns no lines for a charge in a category nothing taxes', () => {
    expect(computeTaxLines([lodgingTax()], stayCharge({ categoryCode: 'exempt' }))).toEqual([])
  })
})

describe('sumTaxLines', () => {
  test('totals the charged amounts, treating a waived line as zero', () => {
    const lines: TaxLine[] = [
      { taxId: 'a', name: 'A', authority: null, rateBp: STATE_RATE_BP, amountCents: 100, exempt: false },
      { taxId: 'b', name: 'B', authority: null, rateBp: COUNTY_RATE_BP, amountCents: 0, exempt: true },
      { taxId: 'c', name: 'C', authority: null, rateBp: CITY_RATE_BP, amountCents: 25, exempt: false },
    ]
    expect(sumTaxLines(lines)).toBe(125)
  })

  test('totals an empty list to zero, which is what an untaxed stay owes', () => {
    expect(sumTaxLines([])).toBe(0)
  })
})

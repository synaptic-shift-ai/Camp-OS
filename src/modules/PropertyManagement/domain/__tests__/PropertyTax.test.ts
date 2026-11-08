/**
 * PropertyTax aggregate.
 *
 * The database enforces these same shapes with check constraints, but an
 * operator saving a bad tax should get a 400 naming the problem rather than a
 * 500 from Postgres — and the quote path must never load a tax it cannot
 * compute. So the invariants live here too (TE-5).
 */

import { describe, test, expect } from 'vitest'
import { PropertyTax } from '../PropertyTax'
import type { CreatePropertyTaxProps, PropertyTaxRow } from '../PropertyTax'

const TAX_ID = '11111111-1111-4111-8111-111111111111'
const PROPERTY_ID = '22222222-2222-4222-8222-222222222222'

const STATE_RATE_BP = 575 // 5.75%
const BED_TAX_CENTS = 2_00
const OHIO_MAX_NIGHTS = 29 // Ohio exempts stays of 30 nights or more.

const LODGING = 'lodging'

function percentageProps(
  overrides: Partial<CreatePropertyTaxProps> = {},
): CreatePropertyTaxProps {
  return {
    id: TAX_ID,
    propertyId: PROPERTY_ID,
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

describe('PropertyTax.create', () => {
  test('builds a percentage tax carrying every configured field', () => {
    const tax = PropertyTax.create(percentageProps())
    expect({
      id: tax.id,
      propertyId: tax.propertyId,
      name: tax.name,
      authority: tax.authority,
      rateType: tax.rateType,
      rateBp: tax.rateBp,
      amountCents: tax.amountCents,
      appliesToCategories: tax.appliesToCategories,
      enabled: tax.enabled,
    }).toEqual({
      id: TAX_ID,
      propertyId: PROPERTY_ID,
      name: 'State Lodging Tax',
      authority: 'State Department of Taxation',
      rateType: 'percentage',
      rateBp: STATE_RATE_BP,
      amountCents: null,
      appliesToCategories: [LODGING],
      enabled: true,
    })
  })

  test('trims the name and authority, so a space-only authority reads as absent', () => {
    const tax = PropertyTax.create(percentageProps({ name: '  City Tax  ', authority: '   ' }))
    expect([tax.name, tax.authority]).toEqual(['City Tax', null])
  })

  test('rejects a name that is blank once trimmed', () => {
    expect(() => PropertyTax.create(percentageProps({ name: '   ' }))).toThrow(/name is required/i)
  })

  describe('rate shape', () => {
    test('rejects a percentage tax with no rate', () => {
      expect(() => PropertyTax.create(percentageProps({ rateBp: null }))).toThrow(
        /percentage tax requires a rate/i,
      )
    })

    test('rejects a percentage tax that also carries a cent amount', () => {
      expect(() =>
        PropertyTax.create(percentageProps({ amountCents: BED_TAX_CENTS })),
      ).toThrow(/percentage tax cannot also carry a cent amount/i)
    })

    test.each([
      [-1, 'below zero'],
      [10_001, 'above 100%'],
      [57.5, 'fractional'],
    ])('rejects a rate of %s basis points (%s)', (rateBp) => {
      expect(() => PropertyTax.create(percentageProps({ rateBp }))).toThrow(
        /basis points.*whole number between 0 and 10000/i,
      )
    })

    test.each([0, 1, 10_000])('accepts a boundary rate of %i basis points', (rateBp) => {
      expect(PropertyTax.create(percentageProps({ rateBp })).rateBp).toBe(rateBp)
    })

    test.each(['per_night', 'flat'] as const)('accepts a %s tax with a cent amount', (rateType) => {
      const tax = PropertyTax.create(
        percentageProps({ rateType, rateBp: null, amountCents: BED_TAX_CENTS }),
      )
      expect([tax.rateType, tax.amountCents, tax.rateBp]).toEqual([
        rateType,
        BED_TAX_CENTS,
        null,
      ])
    })

    test('rejects a per_night tax with no cent amount', () => {
      expect(() =>
        PropertyTax.create(percentageProps({ rateType: 'per_night', rateBp: null })),
      ).toThrow(/requires a cent amount/i)
    })

    test('rejects a flat tax that also carries a basis point rate', () => {
      expect(() =>
        PropertyTax.create(
          percentageProps({ rateType: 'flat', amountCents: BED_TAX_CENTS }),
        ),
      ).toThrow(/cannot also carry a basis point rate/i)
    })

    test('rejects a negative cent amount', () => {
      expect(() =>
        PropertyTax.create(percentageProps({ rateType: 'flat', rateBp: null, amountCents: -1 })),
      ).toThrow(/cent amount.*whole number of cents/i)
    })
  })

  describe('duration gate', () => {
    test('accepts the Ohio shape: an upper bound with no lower bound', () => {
      const tax = PropertyTax.create(percentageProps({ maxNights: OHIO_MAX_NIGHTS }))
      expect([tax.minNights, tax.maxNights]).toEqual([null, OHIO_MAX_NIGHTS])
    })

    test('rejects an upper bound below the lower bound', () => {
      expect(() =>
        PropertyTax.create(percentageProps({ minNights: 10, maxNights: 9 })),
      ).toThrow(/maximum nights cannot be below minimum nights/i)
    })

    test('accepts a gate where both bounds are the same night count', () => {
      const tax = PropertyTax.create(percentageProps({ minNights: 7, maxNights: 7 }))
      expect([tax.minNights, tax.maxNights]).toEqual([7, 7])
    })

    test.each([
      [-1, 'negative'],
      [2.5, 'fractional'],
    ])('rejects a %s night bound (%s)', (nights) => {
      expect(() => PropertyTax.create(percentageProps({ maxNights: nights }))).toThrow(
        /nights.*whole number/i,
      )
    })
  })

  describe('effective window', () => {
    test('accepts a window whose end is its start', () => {
      const tax = PropertyTax.create(
        percentageProps({ effectiveFrom: '2026-06-01', effectiveTo: '2026-06-01' }),
      )
      expect([tax.effectiveFrom, tax.effectiveTo]).toEqual(['2026-06-01', '2026-06-01'])
    })

    test('rejects a window that ends before it starts', () => {
      expect(() =>
        PropertyTax.create(percentageProps({ effectiveFrom: '2026-06-01', effectiveTo: '2026-05-31' })),
      ).toThrow(/effective end cannot be before the effective start/i)
    })

    test.each(['2026-6-01', '06/01/2026', '2026-13-01', 'soon'])(
      'rejects %s, which is not an ISO calendar date',
      (effectiveFrom) => {
        expect(() => PropertyTax.create(percentageProps({ effectiveFrom }))).toThrow(
          /yyyy-mm-dd/i,
        )
      },
    )
  })

  describe('applicability', () => {
    test('rejects a tax that names no category, because it would charge nothing', () => {
      expect(() => PropertyTax.create(percentageProps({ appliesToCategories: [] }))).toThrow(
        /at least one tax category/i,
      )
    })

    test('collapses a repeated category so it cannot be charged twice', () => {
      const tax = PropertyTax.create(
        percentageProps({ appliesToCategories: [LODGING, LODGING, 'retail'] }),
      )
      expect(tax.appliesToCategories).toEqual([LODGING, 'retail'])
    })
  })

  test('rejects a fractional priority, which would not round-trip through the integer column', () => {
    expect(() => PropertyTax.create(percentageProps({ priority: 1.5 }))).toThrow(
      /priority.*whole number/i,
    )
  })
})

describe('PropertyTax.toTaxDefinition', () => {
  test('hands the tax rules exactly the fields they select and compute on', () => {
    const tax = PropertyTax.create(percentageProps({ maxNights: OHIO_MAX_NIGHTS, priority: 2 }))
    expect(tax.toTaxDefinition()).toEqual({
      id: TAX_ID,
      name: 'State Lodging Tax',
      authority: 'State Department of Taxation',
      rateType: 'percentage',
      rateBp: STATE_RATE_BP,
      amountCents: null,
      minNights: null,
      maxNights: OHIO_MAX_NIGHTS,
      basis: 'pre_tax',
      priority: 2,
      discountsReduceTaxableAmount: true,
      exemptible: true,
      effectiveFrom: null,
      effectiveTo: null,
      enabled: true,
      appliesToCategories: [LODGING],
    })
  })
})

describe('PropertyTax.update', () => {
  test('applies only the named changes and leaves the rest alone', () => {
    const tax = PropertyTax.create(percentageProps())
    tax.update({ name: 'County Lodging Tax', rateBp: 300 })
    expect([tax.name, tax.rateBp, tax.authority, tax.appliesToCategories]).toEqual([
      'County Lodging Tax',
      300,
      'State Department of Taxation',
      [LODGING],
    ])
  })

  test('re-validates the merged result, so a change cannot leave the tax invalid', () => {
    const tax = PropertyTax.create(percentageProps())
    expect(() => tax.update({ rateType: 'per_night' })).toThrow(/requires a cent amount/i)
  })

  test('leaves the tax untouched when a change is rejected', () => {
    const tax = PropertyTax.create(percentageProps())
    expect(() => tax.update({ rateBp: 10_001 })).toThrow()
    expect(tax.rateBp).toBe(STATE_RATE_BP)
  })

  test('treats a field passed as undefined as no change, not as a blank', () => {
    // A partial request body types every key as possibly undefined, so a naive
    // spread would blank whatever the client omitted.
    const tax = PropertyTax.create(percentageProps())
    tax.update({ name: undefined, authority: undefined, rateBp: 300 })
    expect([tax.name, tax.authority, tax.rateBp]).toEqual([
      'State Lodging Tax',
      'State Department of Taxation',
      300,
    ])
  })

  test('accepts a coherent switch of rate type and amount in one change', () => {
    const tax = PropertyTax.create(percentageProps())
    tax.update({ rateType: 'per_night', rateBp: null, amountCents: BED_TAX_CENTS })
    expect([tax.rateType, tax.rateBp, tax.amountCents]).toEqual([
      'per_night',
      null,
      BED_TAX_CENTS,
    ])
  })

  test('advances updatedAt so a concurrent write is detectable', () => {
    const tax = PropertyTax.create(percentageProps())
    const before = tax.updatedAt
    tax.update({ name: 'Renamed' })
    expect(tax.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })
})

describe('PropertyTax.setEnabled', () => {
  test('disables a tax without deleting it, so its history stays intact', () => {
    const tax = PropertyTax.create(percentageProps())
    tax.setEnabled(false)
    expect(tax.enabled).toBe(false)
  })
})

describe('PropertyTax persistence', () => {
  const row = (): PropertyTaxRow => ({
    id: TAX_ID,
    property_id: PROPERTY_ID,
    name: 'State Lodging Tax',
    authority: 'State Department of Taxation',
    rate_type: 'percentage',
    rate_bp: STATE_RATE_BP,
    amount_cents: null,
    min_nights: null,
    max_nights: OHIO_MAX_NIGHTS,
    basis: 'pre_tax',
    priority: 2,
    discounts_reduce_taxable_amount: true,
    exemptible: true,
    effective_from: '2026-06-01',
    effective_to: '2026-09-30',
    enabled: true,
    created_at: '2026-05-01T12:00:00.000Z',
    updated_at: '2026-05-02T12:00:00.000Z',
  })

  test('toPersistence emits exactly the property_taxes columns, with no extras (M-4, TE-4)', () => {
    const tax = PropertyTax.create(percentageProps())
    // These are the actual column names in supabase/migrations for property_taxes.
    const columns = [
      'id',
      'property_id',
      'name',
      'authority',
      'rate_type',
      'rate_bp',
      'amount_cents',
      'min_nights',
      'max_nights',
      'basis',
      'priority',
      'discounts_reduce_taxable_amount',
      'exemptible',
      'effective_from',
      'effective_to',
      'enabled',
      'created_at',
      'updated_at',
    ]
    expect(Object.keys(tax.toPersistence()).sort()).toEqual([...columns].sort())
  })

  test('round-trips every field through persistence (TE-3)', () => {
    const original = PropertyTax.fromPersistence(row(), [LODGING, 'retail'])
    const reconstituted = PropertyTax.fromPersistence(
      original.toPersistence(),
      original.appliesToCategories,
    )
    expect({
      id: reconstituted.id,
      propertyId: reconstituted.propertyId,
      name: reconstituted.name,
      authority: reconstituted.authority,
      rateType: reconstituted.rateType,
      rateBp: reconstituted.rateBp,
      amountCents: reconstituted.amountCents,
      minNights: reconstituted.minNights,
      maxNights: reconstituted.maxNights,
      basis: reconstituted.basis,
      priority: reconstituted.priority,
      discountsReduceTaxableAmount: reconstituted.discountsReduceTaxableAmount,
      exemptible: reconstituted.exemptible,
      effectiveFrom: reconstituted.effectiveFrom,
      effectiveTo: reconstituted.effectiveTo,
      enabled: reconstituted.enabled,
      appliesToCategories: reconstituted.appliesToCategories,
      createdAt: reconstituted.createdAt.toISOString(),
      updatedAt: reconstituted.updatedAt.toISOString(),
    }).toEqual({
      id: TAX_ID,
      propertyId: PROPERTY_ID,
      name: 'State Lodging Tax',
      authority: 'State Department of Taxation',
      rateType: 'percentage',
      rateBp: STATE_RATE_BP,
      amountCents: null,
      minNights: null,
      maxNights: OHIO_MAX_NIGHTS,
      basis: 'pre_tax',
      priority: 2,
      discountsReduceTaxableAmount: true,
      exemptible: true,
      effectiveFrom: '2026-06-01',
      effectiveTo: '2026-09-30',
      enabled: true,
      appliesToCategories: [LODGING, 'retail'],
      createdAt: '2026-05-01T12:00:00.000Z',
      updatedAt: '2026-05-02T12:00:00.000Z',
    })
  })

  test('fromPersistence rejects a row the database should never have held', () => {
    // Defence in depth: a row edited around the check constraints must not
    // reach the quote path as a tax with no computable rate.
    const broken = { ...row(), rate_bp: null }
    expect(() => PropertyTax.fromPersistence(broken, [LODGING])).toThrow(
      /percentage tax requires a rate/i,
    )
  })

  test('fromPersistence rejects an unknown rate type rather than defaulting one', () => {
    const broken = { ...row(), rate_type: 'per_guest' }
    expect(() => PropertyTax.fromPersistence(broken, [LODGING])).toThrow(/unknown rate type/i)
  })

  test('fromPersistence rejects an unknown basis rather than defaulting one', () => {
    const broken = { ...row(), basis: 'post_tax' }
    expect(() => PropertyTax.fromPersistence(broken, [LODGING])).toThrow(/unknown tax basis/i)
  })
})

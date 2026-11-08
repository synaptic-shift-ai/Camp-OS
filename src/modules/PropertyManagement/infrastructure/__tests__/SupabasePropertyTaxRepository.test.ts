/**
 * SupabasePropertyTaxRepository tests, against a mocked client.
 *
 * The point of most of these is tenant isolation: both the settings route and
 * the quote path use the service-role client, which bypasses RLS, so every
 * query has to carry property_id itself (BP-4, D-2). A missing filter is the
 * bug class already live in SupabaseTransactionRepository.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { SupabasePropertyTaxRepository } from '../SupabasePropertyTaxRepository'
import { PropertyTax } from '../../domain/PropertyTax'
import type { PropertyTaxRow } from '../../domain/PropertyTax'

const PROPERTY_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_PROPERTY_ID = '33333333-3333-4333-8333-333333333333'
const STATE_TAX_ID = '11111111-1111-4111-8111-111111111111'
const COUNTY_TAX_ID = '44444444-4444-4444-8444-444444444444'

const STATE_RATE_BP = 575
const COUNTY_RATE_BP = 300
const OHIO_MAX_NIGHTS = 29

type Result = { data: unknown; error: { message: string } | null }

/**
 * A chainable stub that records the filters applied per table and resolves to
 * whatever the test queued for that table.
 */
function createMockClient(results: Record<string, Result>) {
  const filters: Record<string, Record<string, unknown>> = {}
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const updates: Record<string, unknown> = {}

  const from = vi.fn((table: string) => {
    const applied: Record<string, unknown> = (filters[table] ??= {})
    const result = results[table] ?? { data: [], error: null }
    const builder: Record<string, unknown> = {}
    const chain = (key: string) =>
      vi.fn((...args: unknown[]) => {
        applied[`${key}:${String(args[0])}`] = args[1] ?? true
        return builder
      })
    Object.assign(builder, {
      select: vi.fn(() => builder),
      eq: chain('eq'),
      is: chain('is'),
      in: chain('in'),
      order: vi.fn(() => Promise.resolve(result)),
      update: vi.fn((values: Record<string, unknown>) => {
        updates[table] = values
        return builder
      }),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (resolve: (r: Result) => unknown) => Promise.resolve(result).then(resolve),
    })
    return builder
  })

  const rpc = vi.fn((fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args })
    return Promise.resolve({ data: args.p_id, error: results.rpc?.error ?? null })
  })

  return { client: { from, rpc } as never, filters, rpcCalls, updates, from }
}

function taxRow(overrides: Partial<PropertyTaxRow> = {}): PropertyTaxRow {
  return {
    id: STATE_TAX_ID,
    property_id: PROPERTY_ID,
    name: 'State Lodging Tax',
    authority: 'State Department of Taxation',
    rate_type: 'percentage',
    rate_bp: STATE_RATE_BP,
    amount_cents: null,
    min_nights: null,
    max_nights: OHIO_MAX_NIGHTS,
    basis: 'pre_tax',
    priority: 1,
    discounts_reduce_taxable_amount: true,
    exemptible: true,
    effective_from: null,
    effective_to: null,
    enabled: true,
    created_at: '2026-05-01T12:00:00.000Z',
    updated_at: '2026-05-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('SupabasePropertyTaxRepository.findByPropertyId', () => {
  test('returns each tax with the category codes its applicability resolves to', async () => {
    const mock = createMockClient({
      property_taxes: {
        data: [taxRow(), taxRow({ id: COUNTY_TAX_ID, name: 'County Tax', rate_bp: COUNTY_RATE_BP, priority: 2 })],
        error: null,
      },
      tax_applicability: {
        data: [
          { property_tax_id: STATE_TAX_ID, tax_categories: { code: 'lodging' } },
          { property_tax_id: COUNTY_TAX_ID, tax_categories: { code: 'lodging' } },
          { property_tax_id: COUNTY_TAX_ID, tax_categories: { code: 'retail' } },
        ],
        error: null,
      },
    })

    const taxes = await new SupabasePropertyTaxRepository(mock.client).findByPropertyId(PROPERTY_ID)

    expect(taxes.map((t) => [t.id, t.appliesToCategories])).toEqual([
      [STATE_TAX_ID, ['lodging']],
      [COUNTY_TAX_ID, ['lodging', 'retail']],
    ])
  })

  test('filters both queries by property and excludes soft-deleted taxes', async () => {
    const mock = createMockClient({
      property_taxes: { data: [taxRow()], error: null },
      tax_applicability: {
        data: [{ property_tax_id: STATE_TAX_ID, tax_categories: { code: 'lodging' } }],
        error: null,
      },
    })

    await new SupabasePropertyTaxRepository(mock.client).findByPropertyId(PROPERTY_ID)

    expect({
      taxes: mock.filters.property_taxes,
      applicability: mock.filters.tax_applicability,
    }).toEqual({
      taxes: { [`eq:property_id`]: PROPERTY_ID, [`is:deleted_at`]: true },
      applicability: {
        [`eq:property_id`]: PROPERTY_ID,
        [`in:property_tax_id`]: [STATE_TAX_ID],
      },
    })
  })

  test('reads a category code whether the embed arrives as an object or an array', async () => {
    const mock = createMockClient({
      property_taxes: { data: [taxRow()], error: null },
      tax_applicability: {
        data: [{ property_tax_id: STATE_TAX_ID, tax_categories: [{ code: 'lodging' }] }],
        error: null,
      },
    })

    const taxes = await new SupabasePropertyTaxRepository(mock.client).findByPropertyId(PROPERTY_ID)
    expect(taxes[0]?.appliesToCategories).toEqual(['lodging'])
  })

  test('skips the applicability query entirely when the property has no taxes', async () => {
    const mock = createMockClient({ property_taxes: { data: [], error: null } })
    const taxes = await new SupabasePropertyTaxRepository(mock.client).findByPropertyId(PROPERTY_ID)
    expect([taxes, mock.from.mock.calls.map((c) => c[0])]).toEqual([[], ['property_taxes']])
  })

  test('throws naming the property when the tax query fails', async () => {
    const mock = createMockClient({
      property_taxes: { data: null, error: { message: 'connection reset' } },
    })
    await expect(
      new SupabasePropertyTaxRepository(mock.client).findByPropertyId(PROPERTY_ID),
    ).rejects.toThrow(`Failed to load taxes for property ${PROPERTY_ID}: connection reset`)
  })
})

describe('SupabasePropertyTaxRepository.findById', () => {
  test('filters by both id and property, so one tenant cannot read another tax by id', async () => {
    const mock = createMockClient({
      property_taxes: { data: taxRow(), error: null },
      tax_applicability: {
        data: [{ property_tax_id: STATE_TAX_ID, tax_categories: { code: 'lodging' } }],
        error: null,
      },
    })

    const tax = await new SupabasePropertyTaxRepository(mock.client).findById(
      PROPERTY_ID,
      STATE_TAX_ID,
    )

    expect([tax?.id, mock.filters.property_taxes]).toEqual([
      STATE_TAX_ID,
      { [`eq:id`]: STATE_TAX_ID, [`eq:property_id`]: PROPERTY_ID, [`is:deleted_at`]: true },
    ])
  })

  test('returns null rather than throwing when the row is not found', async () => {
    const mock = createMockClient({ property_taxes: { data: null, error: null } })
    await expect(
      new SupabasePropertyTaxRepository(mock.client).findById(OTHER_PROPERTY_ID, STATE_TAX_ID),
    ).resolves.toBeNull()
  })
})

describe('SupabasePropertyTaxRepository.save', () => {
  let mock: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mock = createMockClient({})
  })

  test('writes the tax and its category codes through the one transactional function', async () => {
    const tax = PropertyTax.fromPersistence(taxRow(), ['lodging', 'retail'])
    await new SupabasePropertyTaxRepository(mock.client).save(tax)

    expect(mock.rpcCalls).toEqual([
      {
        fn: 'upsert_property_tax',
        args: {
          p_id: STATE_TAX_ID,
          p_property_id: PROPERTY_ID,
          p_name: 'State Lodging Tax',
          p_authority: 'State Department of Taxation',
          p_rate_type: 'percentage',
          p_rate_bp: STATE_RATE_BP,
          p_amount_cents: null,
          p_min_nights: null,
          p_max_nights: OHIO_MAX_NIGHTS,
          p_basis: 'pre_tax',
          p_priority: 1,
          p_discounts_reduce_taxable_amount: true,
          p_exemptible: true,
          p_effective_from: null,
          p_effective_to: null,
          p_enabled: true,
          p_category_codes: ['lodging', 'retail'],
        },
      },
    ])
  })

  test('throws naming the tax when the write is rejected', async () => {
    const failing = createMockClient({ rpc: { data: null, error: { message: 'check constraint' } } })
    const tax = PropertyTax.fromPersistence(taxRow(), ['lodging'])
    await expect(new SupabasePropertyTaxRepository(failing.client).save(tax)).rejects.toThrow(
      'Failed to save tax "State Lodging Tax": check constraint',
    )
  })
})

describe('SupabasePropertyTaxRepository.softDelete', () => {
  test('stamps deleted_at and scopes the update to the owning property', async () => {
    const mock = createMockClient({ property_taxes: { data: null, error: null } })
    await new SupabasePropertyTaxRepository(mock.client).softDelete(PROPERTY_ID, STATE_TAX_ID)

    expect([
      Object.keys(mock.updates.property_taxes as Record<string, unknown>),
      mock.filters.property_taxes,
    ]).toEqual([
      ['deleted_at'],
      { [`eq:id`]: STATE_TAX_ID, [`eq:property_id`]: PROPERTY_ID },
    ])
  })
})

describe('SupabasePropertyTaxRepository.listCategories', () => {
  test('returns the property categories in display order', async () => {
    const mock = createMockClient({
      tax_categories: {
        data: [
          { id: 'cat-1', code: 'lodging', label: 'Lodging', display_order: 10 },
          { id: 'cat-2', code: 'retail', label: 'Retail goods', display_order: 20 },
        ],
        error: null,
      },
    })

    await expect(
      new SupabasePropertyTaxRepository(mock.client).listCategories(PROPERTY_ID),
    ).resolves.toEqual([
      { id: 'cat-1', code: 'lodging', label: 'Lodging', displayOrder: 10 },
      { id: 'cat-2', code: 'retail', label: 'Retail goods', displayOrder: 20 },
    ])
  })
})

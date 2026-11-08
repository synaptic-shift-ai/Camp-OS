/**
 * Property Taxes API v1 — integration tests.
 *
 * These cover what the route itself decides: who may read and write, what a
 * malformed or incoherent body returns, and that a change is audited. The
 * invariants are PropertyTax's and are tested there; the repository's tenant
 * filters are tested against the repository.
 *
 * Following CLAUDE.md T-2 (integration tests for API route changes).
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

import { GET, POST } from '@/app/api/v1/properties/[propertyId]/taxes/route'
import { PATCH, DELETE } from '@/app/api/v1/properties/[propertyId]/taxes/[taxId]/route'
import { PropertyTax } from '@/modules/PropertyManagement/domain/PropertyTax'

const PROPERTY_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_PROPERTY_TAX_ID = '99999999-9999-4999-8999-999999999999'
const COMPANY_ID = '55555555-5555-4555-8555-555555555555'
const USER_ID = '66666666-6666-4666-8666-666666666666'

const STATE_RATE_BP = 575 // 5.75%
const OHIO_MAX_NIGHTS = 29 // Ohio exempts stays of 30 nights or more.

const authState = { user: { id: USER_ID } as { id: string } | null }
const permissions = { view: true, edit: true }

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: authState.user },
        error: authState.user ? null : { message: 'no session' },
      }),
    },
  }),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
}))

vi.mock('@/lib/rbac', () => ({
  requirePropertyAccess: vi.fn(async () => ({ role: 'manager', companyId: COMPANY_ID })),
  isDenied: vi.fn(() => false),
}))

vi.mock('@/lib/dashboard/property-settings-module-edit', () => ({
  canViewPropertySettingsModule: vi.fn(async () => permissions.view),
  canEditPropertySettingsModule: vi.fn(async () => permissions.edit),
  PROPERTY_SETTINGS_VIEW_FORBIDDEN_MESSAGE: 'no view',
  PROPERTY_SETTINGS_EDIT_FORBIDDEN_MESSAGE: 'no edit',
}))

/** The audit entry a route hands recordActivityLog as its second argument. */
type AuditEntry = {
  companyId: string
  propertyId: string
  action: string
  resource: string
  userId: string
  details: string
}

const recordActivityLog = vi.fn(
  async (_client: unknown, _entry: AuditEntry, _options?: unknown) => undefined,
)
vi.mock('@/shared/activity-log/record-activity-log', () => ({
  recordActivityLog: (client: unknown, entry: AuditEntry, options?: unknown) =>
    recordActivityLog(client, entry, options),
}))

const repo = {
  findByPropertyId: vi.fn(),
  findById: vi.fn(),
  // Parameters are declared so mock.calls stays typed and the assertions below
  // can read what the route actually passed.
  save: vi.fn(async (_tax: PropertyTax) => undefined),
  softDelete: vi.fn(async (_propertyId: string, _taxId: string) => undefined),
  listCategories: vi.fn(async () => [
    { id: 'cat-1', code: 'lodging', label: 'Lodging', displayOrder: 10 },
  ]),
}
vi.mock('@/modules/PropertyManagement/infrastructure/SupabasePropertyTaxRepository', () => ({
  SupabasePropertyTaxRepository: class {
    findByPropertyId = repo.findByPropertyId
    findById = repo.findById
    save = repo.save
    softDelete = repo.softDelete
    listCategories = repo.listCategories
  },
}))

function existingTax(): PropertyTax {
  return PropertyTax.create({
    id: '11111111-1111-4111-8111-111111111111',
    propertyId: PROPERTY_ID,
    name: 'State Lodging Tax',
    authority: 'State Department of Taxation',
    rateType: 'percentage',
    rateBp: STATE_RATE_BP,
    amountCents: null,
    minNights: null,
    maxNights: OHIO_MAX_NIGHTS,
    basis: 'pre_tax',
    priority: 1,
    discountsReduceTaxableAmount: true,
    exemptible: true,
    effectiveFrom: null,
    effectiveTo: null,
    enabled: true,
    appliesToCategories: ['lodging'],
  })
}

const validBody = {
  name: 'County Lodging Tax',
  authority: 'Ashtabula County',
  rateType: 'percentage',
  rateBp: 300,
  maxNights: OHIO_MAX_NIGHTS,
  appliesToCategories: ['lodging'],
}

function req(body?: unknown): never {
  return {
    headers: { get: () => null },
    url: `http://localhost/api/v1/properties/${PROPERTY_ID}/taxes`,
    json: async () => body,
  } as never
}

const params = (taxId = '11111111-1111-4111-8111-111111111111') =>
  ({ params: Promise.resolve({ propertyId: PROPERTY_ID, taxId }) }) as never

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { id: USER_ID }
  permissions.view = true
  permissions.edit = true
  repo.save.mockResolvedValue(undefined)
  repo.softDelete.mockResolvedValue(undefined)
  repo.listCategories.mockResolvedValue([
    { id: 'cat-1', code: 'lodging', label: 'Lodging', displayOrder: 10 },
  ])
})

describe('GET /api/v1/properties/[propertyId]/taxes', () => {
  test('returns the configured taxes alongside the categories they can charge on', async () => {
    repo.findByPropertyId.mockResolvedValue([existingTax()])

    const body = await (await GET(req(), params())).json()

    expect({
      taxes: body.data.taxes.map((t: { name: string; rateBp: number; maxNights: number }) => [
        t.name,
        t.rateBp,
        t.maxNights,
      ]),
      categories: body.data.categories,
    }).toEqual({
      taxes: [['State Lodging Tax', STATE_RATE_BP, OHIO_MAX_NIGHTS]],
      categories: [{ id: 'cat-1', code: 'lodging', label: 'Lodging', displayOrder: 10 }],
    })
  })

  test('returns an empty list, not an error, for a property with no taxes configured', async () => {
    repo.findByPropertyId.mockResolvedValue([])
    const body = await (await GET(req(), params())).json()
    expect(body.data.taxes).toEqual([])
  })

  test('refuses a user without settings view access', async () => {
    permissions.view = false
    repo.findByPropertyId.mockResolvedValue([])
    const response = await GET(req(), params())
    expect([response.status, repo.findByPropertyId.mock.calls.length]).toEqual([403, 0])
  })

  test('refuses an unauthenticated request', async () => {
    authState.user = null
    const response = await GET(req(), params())
    expect(response.status).toBe(401)
  })
})

describe('POST /api/v1/properties/[propertyId]/taxes', () => {
  test('creates the tax and audits it with the authority it is remitted to', async () => {
    const response = await POST(req(validBody), params())
    const body = await response.json()

    expect({
      status: response.status,
      tax: [body.data.tax.name, body.data.tax.rateBp, body.data.tax.appliesToCategories],
      saved: repo.save.mock.calls.length,
      audit: recordActivityLog.mock.calls[0]?.[1],
    }).toEqual({
      status: 200,
      tax: ['County Lodging Tax', 300, ['lodging']],
      saved: 1,
      audit: {
        companyId: COMPANY_ID,
        propertyId: PROPERTY_ID,
        action: 'create',
        resource: 'property_tax',
        userId: USER_ID,
        details: 'Added tax "County Lodging Tax" (Ashtabula County).',
      },
    })
  })

  test('assigns the tax to the property in the path, not one named in the body', async () => {
    await POST(req({ ...validBody, propertyId: OTHER_PROPERTY_TAX_ID }), params())
    const saved = repo.save.mock.calls[0]?.[0]
    expect(saved?.propertyId).toBe(PROPERTY_ID)
  })

  test('rejects a tax that names no category, without writing anything', async () => {
    const response = await POST(req({ ...validBody, appliesToCategories: [] }), params())
    expect([response.status, repo.save.mock.calls.length]).toEqual([400, 0])
  })

  test('returns the aggregate wording when a percentage tax carries no rate', async () => {
    const { rateBp: _rateBp, ...noRate } = validBody
    const body = await (await POST(req(noRate), params())).json()
    expect(body.error.details.message).toMatch(/percentage tax requires a rate/i)
  })

  test('returns the aggregate wording when the duration gate is inverted', async () => {
    const response = await POST(
      req({ ...validBody, minNights: 10, maxNights: 9 }),
      params(),
    )
    const body = await response.json()
    expect([response.status, body.error.details.message]).toEqual([
      400,
      'Maximum nights cannot be below minimum nights (9 < 10)',
    ])
  })

  test('refuses a user who may view settings but not edit them', async () => {
    permissions.edit = false
    const response = await POST(req(validBody), params())
    expect([response.status, repo.save.mock.calls.length]).toEqual([403, 0])
  })
})

describe('PATCH /api/v1/properties/[propertyId]/taxes/[taxId]', () => {
  test('applies the named change and leaves the rest of the tax alone', async () => {
    repo.findById.mockResolvedValue(existingTax())

    const body = await (await PATCH(req({ rateBp: 650 }), params())).json()

    expect([body.data.tax.rateBp, body.data.tax.name, body.data.tax.maxNights]).toEqual([
      650,
      'State Lodging Tax',
      OHIO_MAX_NIGHTS,
    ])
  })

  test('reports a tax belonging to another property as not found', async () => {
    repo.findById.mockResolvedValue(null)
    const response = await PATCH(req({ rateBp: 650 }), params(OTHER_PROPERTY_TAX_ID))
    expect([response.status, repo.save.mock.calls.length]).toEqual([404, 0])
  })

  test('rejects an empty body rather than writing an unchanged tax', async () => {
    repo.findById.mockResolvedValue(existingTax())
    const response = await PATCH(req({}), params())
    expect([response.status, repo.save.mock.calls.length]).toEqual([400, 0])
  })

  test('rejects a change that would leave the tax incoherent, and saves nothing', async () => {
    repo.findById.mockResolvedValue(existingTax())
    const response = await PATCH(req({ rateType: 'per_night' }), params())
    const body = await response.json()
    expect([response.status, body.error.details.message, repo.save.mock.calls.length]).toEqual([
      400,
      'A per_night tax requires a cent amount',
      0,
    ])
  })

  test('names the changed fields in the audit entry', async () => {
    repo.findById.mockResolvedValue(existingTax())
    await PATCH(req({ rateBp: 650, enabled: false }), params())
    expect(recordActivityLog.mock.calls[0]?.[1]).toEqual({
      companyId: COMPANY_ID,
      propertyId: PROPERTY_ID,
      action: 'update',
      resource: 'property_tax',
      userId: USER_ID,
      details: 'Updated tax "State Lodging Tax" (rateBp, enabled).',
    })
  })
})

describe('DELETE /api/v1/properties/[propertyId]/taxes/[taxId]', () => {
  test('soft-deletes the tax and records that charged lines keep their rate', async () => {
    repo.findById.mockResolvedValue(existingTax())

    const response = await DELETE(req(), params())

    expect({
      status: response.status,
      deleted: repo.softDelete.mock.calls[0],
      details: recordActivityLog.mock.calls[0]?.[1]?.details,
    }).toEqual({
      status: 200,
      deleted: [PROPERTY_ID, '11111111-1111-4111-8111-111111111111'],
      details:
        'Removed tax "State Lodging Tax". Existing tax lines keep the rate they were charged at.',
    })
  })

  test('reports a tax belonging to another property as not found, and deletes nothing', async () => {
    repo.findById.mockResolvedValue(null)
    const response = await DELETE(req(), params(OTHER_PROPERTY_TAX_ID))
    expect([response.status, repo.softDelete.mock.calls.length]).toEqual([404, 0])
  })
})

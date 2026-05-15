import { describe, it, expect, vi, beforeEach } from 'vitest'

import { POST } from '@/app/api/v1/properties/[propertyId]/maintenance/route'
import { GET as BOOKING_CONFLICTS_GET } from '@/app/api/v1/properties/[propertyId]/maintenance/booking-conflicts/route'

const validUUID = () => crypto.randomUUID()

type SupabaseResult<T> = Promise<{ data: T; error: unknown }>

type FromBuilder = {
  select: (...args: unknown[]) => FromBuilder
  eq: (...args: unknown[]) => FromBuilder
  in: (...args: unknown[]) => FromBuilder
  lt: (...args: unknown[]) => FromBuilder
  gt: (...args: unknown[]) => Promise<{ count: number | null; error: unknown }>
  is: (...args: unknown[]) => FromBuilder
  maybeSingle: () => SupabaseResult<unknown>
  order: (...args: unknown[]) => FromBuilder
}

function createFromBuilder(handlers: {
  maybeSingle?: () => SupabaseResult<unknown>
  gt?: () => Promise<{ count: number | null; error: unknown }>
}): FromBuilder {
  const builder: FromBuilder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    lt: () => builder,
    is: () => builder,
    order: () => builder,
    maybeSingle: handlers.maybeSingle ?? (async () => ({ data: null, error: null })),
    gt: handlers.gt ?? (async () => ({ count: 0, error: null })),
  }
  return builder
}

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: () => mockCreateClient() }))

vi.mock('@/lib/rbac', () => ({
  requirePropertyAccess: vi.fn(async () => ({ role: 'admin', companyId: validUUID() })),
  isDenied: vi.fn(() => false),
}))

vi.mock('@/lib/dashboard/module-action-access', () => ({
  resolveModuleActionAccess: vi.fn(async () => ({
    create: true,
    'enter-labor-cost': true,
    'assign-wo': true,
  })),
}))

vi.mock('@/lib/dashboard/maintenance-module-access', () => ({
  maintenanceFallbackForCategory: vi.fn(() => true),
}))

const createMaintenanceTask = vi.fn(async () => {
  throw new Error('createMaintenanceTask should not be called when reservation conflicts exist')
})

vi.mock('@/lib/dashboard/maintenance/maintenance-queries', () => ({
  MaintenanceQueries: class MaintenanceQueries {
    findOverlappingMaintenance = vi.fn(async () => [])
    listSpendLimits = vi.fn(async () => [])
    createMaintenanceTask = createMaintenanceTask
    getCategorySpend = vi.fn(async () => 0)
  },
}))

// Avoid side effects (email, activity logs, automations)
vi.mock('@/lib/supabase/service-role', () => ({ createServiceRoleClient: vi.fn() }))
vi.mock('@/shared/activity-log/record-activity-log', () => ({ recordActivityLog: vi.fn(async () => null) }))
vi.mock('@/lib/email/emailit', () => ({ sendEmail: vi.fn(async () => ({ success: true, id: 'mock-id', attempts: 1 })), getFrom: vi.fn(() => 'test@example.com') }))
vi.mock('@/lib/email/template-renderer', () => ({ renderWithContext: vi.fn(() => ({ subject: 'x', html: '<div />', text: 'x' })) }))
vi.mock('@/lib/email/templates/vendor-work-order-assigned', () => ({ buildVendorWorkOrderAssignedEmailHtml: vi.fn(async () => '<div />') }))
vi.mock('@/modules/Maintenance/domain/events', () => ({
  MaintenanceTaskCreatedEvent: vi.fn(),
}))
vi.mock('@/lib/automations/event-context', () => ({ buildEventContext: vi.fn(async () => ({ propertyId: null, companyId: null })) }))
vi.mock('@/lib/automations/run-pipeline', () => ({ runPipelineForTrigger: vi.fn(async () => null) }))

describe('Maintenance API v1 (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks maintenance task creation when scheduled window overlaps a reservation', async () => {
    const propertyId = validUUID()
    const siteId = validUUID()

    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: validUUID(), email: 'admin@example.com' } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'sites') {
          return createFromBuilder({
            maybeSingle: async () => ({
              data: { id: siteId, site_type: null },
              error: null,
            }),
          })
        }
        if (table === 'properties') {
          return createFromBuilder({
            maybeSingle: async () => ({
              data: { site_type_config: null },
              error: null,
            }),
          })
        }
        if (table === 'reservations') {
          return createFromBuilder({
            gt: async () => ({ count: 1, error: null }),
          })
        }
        return createFromBuilder({})
      }),
    }

    mockCreateClient.mockReturnValue(supabase)

    const scheduledStart = new Date('2026-05-07T09:00:00.000Z').toISOString()
    const dueDate = new Date('2026-05-08T09:00:00.000Z').toISOString()

    const request = new Request(`http://localhost/api/v1/properties/${propertyId}/maintenance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'test-request' },
      body: JSON.stringify({
        siteId,
        title: 'Fix AC',
        scheduledStart,
        dueDate,
      }),
    }) as Parameters<typeof POST>[0]

    const response = await POST(request, { params: Promise.resolve({ propertyId }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    })
    expect(json.error.details).toMatchObject({
      message: expect.any(String),
      reservationConflicts: 1,
    })

    expect(createMaintenanceTask).not.toHaveBeenCalled()
  })

  it('returns firstReservationConflict details when booking conflicts exist', async () => {
    const propertyId = validUUID()
    const siteId = validUUID()

    const reservationRow = {
      confirmation_number: 'A102',
      check_in_date: '2026-05-07',
      check_out_date: '2026-05-10',
    }

    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: validUUID(), email: 'admin@example.com' } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'reservations') {
          let headCountMode = false
          const builder: FromBuilder = {
            select: (...args: unknown[]) => {
              const maybeOptions = args[1]
              headCountMode = Boolean(
                typeof maybeOptions === 'object'
                  && maybeOptions !== null
                  && 'head' in maybeOptions
                  && (maybeOptions as { head?: unknown }).head,
              )
              return builder
            },
            eq: () => builder,
            in: () => builder,
            lt: () => builder,
            gt: async () => ({ count: 1, error: null }),
            is: () => builder,
            order: () => builder,
            maybeSingle: async () => ({
              data: headCountMode ? null : reservationRow,
              error: null,
            }),
          }
          return builder
        }
        return createFromBuilder({})
      }),
    }

    mockCreateClient.mockReturnValue(supabase)

    const request = new Request(
      `http://localhost/api/v1/properties/${propertyId}/maintenance/booking-conflicts?siteId=${siteId}&startDate=2026-05-07T09:00:00.000Z&endDate=2026-05-08T09:00:00.000Z`,
      {
        method: 'GET',
        headers: { 'x-request-id': 'test-request' },
      },
    ) as Parameters<typeof BOOKING_CONFLICTS_GET>[0]

    const response = await BOOKING_CONFLICTS_GET(request, { params: Promise.resolve({ propertyId }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      success: true,
      data: {
        reservationConflicts: 1,
        firstReservationConflict: {
          confirmationNumber: 'A102',
          checkInDate: '2026-05-08',
          checkOutDate: '2026-05-10',
        },
      },
    })
  })
})


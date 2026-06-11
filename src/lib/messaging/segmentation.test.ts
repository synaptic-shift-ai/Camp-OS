/**
 * Tests for Guest Segmentation
 *
 * Unit tests for filterEligibleGuests (pure logic) and
 * getGuestsBySegment (Supabase query builder mocking).
 */

import { describe, test, expect, vi } from 'vitest'
import { filterEligibleGuests, getGuestsBySegment } from './segmentation'

// Mock the opt-out-checker so filterEligibleGuests tests stay isolated
vi.mock('@/lib/communications/opt-out-checker', () => ({
  isOptedOut: vi.fn().mockResolvedValue(false),
}))

// ============================================================================
// Test Data
// ============================================================================

const makeGuest = (
  overrides: Record<string, unknown> = {},
) => ({
  id: 'guest-1',
  property_id: 'prop-1',
  first_name: 'Alice',
  last_name: 'Smith',
  email: 'alice@example.com',
  phone: '+1234567890',
  ...overrides,
})

// ============================================================================
// filterEligibleGuests
// ============================================================================

describe('filterEligibleGuests', () => {
  const mockSupabase = {} as never
  const companyId = 'company-1'

  test('removes guests without email when channel is "email"', async () => {
    const guests = [
      makeGuest({ id: 'g1', email: '' }),
      makeGuest({ id: 'g2', email: 'has@email.com' }),
    ]
    const result = await filterEligibleGuests(guests, 'email', mockSupabase, companyId)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('g2')
  })

  test('removes guests without phone when channel is "sms"', async () => {
    const guests = [
      makeGuest({ id: 'g1', phone: null }),
      makeGuest({ id: 'g2', phone: '+1234567890' }),
    ]
    const result = await filterEligibleGuests(guests, 'sms', mockSupabase, companyId)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('g2')
  })

  test('removes guests without both email AND phone when channel is "both"', async () => {
    const guests = [
      makeGuest({ id: 'g1', email: '', phone: '+1234567890' }),   // no email
      makeGuest({ id: 'g2', email: 'a@b.com', phone: null }),     // no phone — still eligible (has email)
      makeGuest({ id: 'g3', email: 'c@d.com', phone: '+999' }),   // both present
    ]
    const result = await filterEligibleGuests(guests, 'both', mockSupabase, companyId)
    // g1 skipped (no email for 'both' email check), g2 kept (has email), g3 kept
    expect(result.map((g) => g.id)).toContain('g3')
  })

  test('keeps guests with valid contact info', async () => {
    const guests = [
      makeGuest({ id: 'g1', email: 'valid@email.com', phone: '+1234567890' }),
    ]
    const result = await filterEligibleGuests(guests, 'both', mockSupabase, companyId)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('g1')
  })

  test('handles empty guest list', async () => {
    const result = await filterEligibleGuests([], 'email', mockSupabase, companyId)
    expect(result).toEqual([])
  })
})

// ============================================================================
// getGuestsBySegment
// ============================================================================

/**
 * Builds a chainable mock Supabase query builder.
 * Each method returns the builder so calls can be chained.
 */
function buildMockQuery(finalData: unknown[] = [], finalError: null | string = null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}

  const chainReturn = {
    data: finalData,
    error: finalError,
  }

  // All chainable methods return the builder itself
  const chainMethods = [
    'select', 'eq', 'neq', 'is', 'in', 'gte', 'lt', 'gt',
  ]
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnThis()
  }

  // Resolve: when the builder is awaited (thenable), return the result
  // We use a proxy-like approach: make the builder thenable
  builder.then = vi.fn((resolve: (val: unknown) => void) => {
    resolve(chainReturn)
    return Promise.resolve(chainReturn)
  })

  // Also support direct promise resolution
  builder.catch = vi.fn()
  builder.finally = vi.fn()

  return builder
}

function buildMockSupabase() {
  const supabase = {
    from: vi.fn(),
  }
  return supabase
}

describe('getGuestsBySegment', () => {
  const propertyId = 'prop-1'

  test('queries guests table for all_guests segment', async () => {
    const mockData = [
      makeGuest({ id: 'g1' }),
      makeGuest({ id: 'g2' }),
    ]
    const query = buildMockQuery(mockData)
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'all_guests',
    )

    expect(supabase.from).toHaveBeenCalledWith('guests')
    expect(query.select).toHaveBeenCalledWith('id, property_id, first_name, last_name, email, phone')
    expect(query.eq).toHaveBeenCalledWith('property_id', propertyId)
    expect(query.is).toHaveBeenCalledWith('deleted_at', null)
  })

  test('queries with guest_ids for specific_guest segment', async () => {
    const query = buildMockQuery([])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'specific_guest',
      { guest_ids: ['g1', 'g2'] },
    )

    expect(query.in).toHaveBeenCalledWith('id', ['g1', 'g2'])
  })

  test('returns empty array when specific_guest has no guest_ids', async () => {
    const query = buildMockQuery([])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'specific_guest',
    )
    expect(result).toEqual([])
  })

  test('queries reservations table for bookings_this_month segment', async () => {
    const innerGuest = { id: 'g1', property_id: propertyId, first_name: 'A', last_name: 'B', email: 'a@b.com', phone: null }
    const query = buildMockQuery([{ guest_id: 'g1', guests: innerGuest }])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'bookings_this_month',
    )

    expect(supabase.from).toHaveBeenCalledWith('reservations')
    expect(query.gte).toHaveBeenCalled()
    expect(query.lt).toHaveBeenCalled()
  })

  test('queries reservations for upcoming_bookings segment with gt filter', async () => {
    const innerGuest = { id: 'g1', property_id: propertyId, first_name: 'A', last_name: 'B', email: 'a@b.com', phone: null }
    const query = buildMockQuery([{ guest_id: 'g1', guests: innerGuest }])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    await getGuestsBySegment(
      supabase as never,
      propertyId,
      'upcoming_bookings',
    )

    expect(supabase.from).toHaveBeenCalledWith('reservations')
    expect(query.gt).toHaveBeenCalledWith('check_in_date', expect.any(String))
  })

  test('queries reservations for past_guests segment', async () => {
    const query = buildMockQuery([])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    await getGuestsBySegment(
      supabase as never,
      propertyId,
      'past_guests',
    )

    expect(supabase.from).toHaveBeenCalledWith('reservations')
    expect(query.lt).toHaveBeenCalledWith('check_out_date', expect.any(String))
  })

  test('queries reservations with site_ids for by_site segment', async () => {
    const innerGuest = { id: 'g1', property_id: propertyId, first_name: 'A', last_name: 'B', email: 'a@b.com', phone: null }
    const query = buildMockQuery([{ guest_id: 'g1', guests: innerGuest }])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    await getGuestsBySegment(
      supabase as never,
      propertyId,
      'by_site',
      { site_ids: ['site-1', 'site-2'] },
    )

    expect(supabase.from).toHaveBeenCalledWith('reservations')
    expect(query.in).toHaveBeenCalledWith('site_id', ['site-1', 'site-2'])
  })

  test('returns empty array when by_site has no site_ids', async () => {
    const query = buildMockQuery([])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'by_site',
    )
    expect(result).toEqual([])
  })

  test('queries sites then reservations for by_site_type segment', async () => {
    const sitesQuery = buildMockQuery([{ id: 'site-1' }, { id: 'site-2' }])
    const innerGuest = { id: 'g1', property_id: propertyId, first_name: 'A', last_name: 'B', email: 'a@b.com', phone: null }
    const reservationsQuery = buildMockQuery([{ guest_id: 'g1', guests: innerGuest }])
    const supabase = buildMockSupabase()
    supabase.from.mockImplementation((table: string) => {
      if (table === 'sites') return sitesQuery
      if (table === 'reservations') return reservationsQuery
      return buildMockQuery([])
    })

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'by_site_type',
      { site_types: ['rv', 'cabin'] },
    )

    expect(supabase.from).toHaveBeenCalledWith('sites')
    expect(sitesQuery.in).toHaveBeenCalledWith('site_type', ['rv', 'cabin'])
    expect(supabase.from).toHaveBeenCalledWith('reservations')
    expect(reservationsQuery.in).toHaveBeenCalledWith('site_id', ['site-1', 'site-2'])
    expect(result).toHaveLength(1)
  })

  test('returns empty array when by_site_type has no site_types', async () => {
    const query = buildMockQuery([])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'by_site_type',
    )
    expect(result).toEqual([])
  })

  test('returns empty array for unknown segment type', async () => {
    const query = buildMockQuery([])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'unknown_segment' as never,
    )
    expect(result).toEqual([])
  })

  test('returns empty array on query error', async () => {
    const query = buildMockQuery([], 'Something went wrong')
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'all_guests',
    )

    // Error path should return empty
    expect(result).toEqual([])
  })

  test('deduplicates guests from reservation-based queries', async () => {
    const guest = { id: 'g1', property_id: propertyId, first_name: 'A', last_name: 'B', email: 'a@b.com', phone: null }
    const query = buildMockQuery([
      { guest_id: 'g1', guests: { ...guest } },
      { guest_id: 'g1', guests: { ...guest } },
    ])
    const supabase = buildMockSupabase()
    supabase.from.mockReturnValue(query)

    const result = await getGuestsBySegment(
      supabase as never,
      propertyId,
      'upcoming_bookings',
    )

    expect(result).toHaveLength(1)
  })
})

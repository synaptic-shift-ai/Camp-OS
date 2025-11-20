/**
 * Tests for Reservation Creation Functions
 *
 * Following TDD best practices:
 * - Dynamic date/ID generation
 * - Test critical business logic
 * - Integration tests (DB-touching)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createReservation } from './reservation'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { futureDays, bookingDateRange } from './test-utils/date-helpers'
import { testPropertyId, testSiteId, testUUID } from './test-utils/id-helpers'
import type { Site, CreateReservationInput } from './types'

describe('createReservation', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
    site: Site
  }

  beforeAll(async () => {
    const property_id = testPropertyId()
    const site_id = testSiteId()

    // Create test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Reservation Campground',
      slug: 'test-reservation-' + Date.now(),
      owner_id: testUUID(),
    })

    // Create test site
    const { data: site, error } = await supabase
      .from('sites')
      .insert({
        id: site_id,
        property_id,
        site_number: 'R1',
        site_name: 'Reservation Test Site',
        site_type: 'rv',
        max_occupancy: 4,
        max_vehicles: 2,
        hookups: ['electric'],
        amenities: ['wifi'],
        base_price: 75.0,
        status: 'available',
        allow_pets: true,
        pet_fee: 20.0,
        ada_accessible: false,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create test site: ${error.message}`)

    testData = {
      property_id,
      site: site as Site,
    }
  })

  afterAll(async () => {
    await supabase.from('reservations').delete().eq('property_id', testData.property_id)
    await supabase.from('guests').delete().eq('property_id', testData.property_id)
    await supabase.from('sites').delete().eq('property_id', testData.property_id)
    await supabase.from('properties').delete().eq('id', testData.property_id)
  })

  test('should create reservation with new guest', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(7, 3)

    const input: CreateReservationInput = {
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest: {
        first_name: 'New',
        last_name: 'Guest',
        email: `new-guest-${Date.now()}@example.com`,
        phone: '555-1000',
      },
      check_in_date,
      check_out_date,
      num_adults: 2,
      num_children: 1,
      num_pets: 0,
      num_vehicles: 1,
      source: 'online',
    }

    const result = await createReservation(input)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.property_id).toBe(testData.property_id)
      expect(result.data.site_id).toBe(testData.site.id)
      expect(result.data.status).toBe('pending')
      expect(result.data.payment_status).toBe('unpaid')
      expect(result.data.confirmation_number).toMatch(/^CAMP-\d{4}-[A-Z0-9]{6}$/)
      expect(result.data.total_amount).toBeGreaterThan(0)
      expect(result.data.guest_id).toBeDefined()
    }
  })

  test('should create reservation with existing guest', async () => {
    const email = `existing-guest-${Date.now()}@example.com`
    const { check_in_date: firstCheckIn, check_out_date: firstCheckOut } =
      bookingDateRange(7, 3)

    // Create first reservation (creates guest)
    const firstInput: CreateReservationInput = {
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest: {
        first_name: 'Existing',
        last_name: 'Guest',
        email,
        phone: '555-2000',
      },
      check_in_date: firstCheckIn,
      check_out_date: firstCheckOut,
      num_adults: 2,
      source: 'online',
    }

    const firstResult = await createReservation(firstInput)
    expect(firstResult.success).toBe(true)
    const firstGuestId = firstResult.success ? firstResult.data.guest_id : null

    // Create second reservation with same email (different dates)
    const { check_in_date: secondCheckIn, check_out_date: secondCheckOut } =
      bookingDateRange(30, 2)

    const secondInput: CreateReservationInput = {
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest: {
        first_name: 'Existing',
        last_name: 'Guest',
        email, // Same email
        phone: '555-2000',
      },
      check_in_date: secondCheckIn,
      check_out_date: secondCheckOut,
      num_adults: 1,
      source: 'online',
    }

    const secondResult = await createReservation(secondInput)
    expect(secondResult.success).toBe(true)
    if (secondResult.success && firstGuestId) {
      // Should reuse the same guest
      expect(secondResult.data.guest_id).toBe(firstGuestId)
    }
  })

  test('should prevent double-booking (overlapping dates)', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(40, 3)

    // Create first reservation
    const firstInput: CreateReservationInput = {
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest: {
        first_name: 'First',
        last_name: 'Booker',
        email: `first-${Date.now()}@example.com`,
        phone: '555-3000',
      },
      check_in_date,
      check_out_date,
      num_adults: 2,
      source: 'online',
    }

    const firstResult = await createReservation(firstInput)
    expect(firstResult.success).toBe(true)

    // Try to book overlapping dates
    const overlapCheckIn = futureDays(41) // One day after original checkin
    const overlapCheckOut = futureDays(44)

    const overlapInput: CreateReservationInput = {
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest: {
        first_name: 'Second',
        last_name: 'Booker',
        email: `second-${Date.now()}@example.com`,
        phone: '555-3001',
      },
      check_in_date: overlapCheckIn,
      check_out_date: overlapCheckOut,
      num_adults: 2,
      source: 'online',
    }

    const overlapResult = await createReservation(overlapInput)
    expect(overlapResult.success).toBe(false)
    if (!overlapResult.success) {
      expect(overlapResult.error.code).toBe('SITE_UNAVAILABLE')
    }
  })

  test('should calculate correct total with pet fee', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(50, 2) // 2 nights

    const input: CreateReservationInput = {
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest: {
        first_name: 'Pet',
        last_name: 'Owner',
        email: `pet-owner-${Date.now()}@example.com`,
        phone: '555-4000',
      },
      check_in_date,
      check_out_date,
      num_adults: 2,
      num_pets: 1, // Has pet
      source: 'online',
    }

    const result = await createReservation(input)

    expect(result.success).toBe(true)
    if (result.success) {
      // Base: 75 * 2 nights = 150
      // Pet fee: 20
      // Total: 170
      expect(result.data.total_amount).toBe(170.0)
    }
  })

  test('should reject reservation for past dates', async () => {
    const pastCheckIn = futureDays(-5)
    const pastCheckOut = futureDays(-2)

    const input: CreateReservationInput = {
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest: {
        first_name: 'Past',
        last_name: 'Guest',
        email: `past-${Date.now()}@example.com`,
        phone: '555-5000',
      },
      check_in_date: pastCheckIn,
      check_out_date: pastCheckOut,
      num_adults: 2,
      source: 'online',
    }

    const result = await createReservation(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_DATE_RANGE')
    }
  })

  test('should reject reservation for non-existent site', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(60, 3)

    const input: CreateReservationInput = {
      property_id: testData.property_id,
      site_id: testUUID(), // Non-existent site
      guest: {
        first_name: 'Invalid',
        last_name: 'Site',
        email: `invalid-site-${Date.now()}@example.com`,
        phone: '555-6000',
      },
      check_in_date,
      check_out_date,
      num_adults: 2,
      source: 'online',
    }

    const result = await createReservation(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('SITE_NOT_FOUND')
    }
  })
})

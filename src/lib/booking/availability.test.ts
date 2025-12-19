/**
 * Tests for Availability Query Functions
 *
 * ⚠️ SKIPPED: Legacy integration tests requiring real Supabase connection
 * These tests are in lib/booking/ which is scheduled for deletion.
 * Contract tests now exist in tests/integration/v1-reservations-api.test.ts
 *
 * To run these tests locally with real DB:
 * 1. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * 2. Remove .skip from describe blocks
 *
 * Following TDD best practices:
 * - Dynamic date generation (no hardcoded dates)
 * - Dynamic ID generation (no hardcoded IDs)
 * - Test edge cases and boundaries
 * - Integration tests (DB-touching)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { checkSiteAvailability, searchAvailableSites } from './availability'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { futureDays, bookingDateRange, pastDays } from './test-utils/date-helpers'
import { testPropertyId, testSiteId, testGuestId, testUUID } from './test-utils/id-helpers'
import type { Site, Reservation, Guest } from './types'

describe('checkSiteAvailability', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
    site: Site
    guest: Guest
  }

  beforeAll(async () => {
    // Create test property, site, and guest for integration tests
    const property_id = testPropertyId()
    const site_id = testSiteId()
    const guest_id = testGuestId()

    // Insert test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Campground',
      slug: 'test-campground-' + Date.now(),
      owner_id: testUUID(),
    })

    // Insert test site
    const siteData: Partial<Site> = {
      id: site_id,
      property_id,
      site_number: '1A',
      site_name: 'Test Site 1A',
      site_type: 'rv',
      max_occupancy: 4,
      max_vehicles: 2,
      hookups: ['electric', 'water'],
      amenities: ['wifi', 'firepit'],
      base_price: 50.0,
      status: 'available',
      allow_pets: true,
      ada_accessible: false,
    }

    const { data: insertedSite, error: siteError } = await supabase
      .from('sites')
      .insert(siteData)
      .select()
      .single()

    if (siteError) throw new Error(`Failed to create test site: ${siteError.message}`)

    // Insert test guest
    const guestData: Partial<Guest> = {
      id: guest_id,
      property_id,
      first_name: 'Test',
      last_name: 'Guest',
      email: `test-${Date.now()}@example.com`,
      phone: '555-0100',
    }

    const { data: insertedGuest, error: guestError } = await supabase
      .from('guests')
      .insert(guestData)
      .select()
      .single()

    if (guestError) throw new Error(`Failed to create test guest: ${guestError.message}`)

    testData = {
      property_id,
      site: insertedSite as Site,
      guest: insertedGuest as Guest,
    }
  })

  afterAll(async () => {
    // Clean up test data
    await supabase.from('reservations').delete().eq('property_id', testData.property_id)
    await supabase.from('guests').delete().eq('property_id', testData.property_id)
    await supabase.from('sites').delete().eq('property_id', testData.property_id)
    await supabase.from('properties').delete().eq('id', testData.property_id)
  })

  test('should return true for available site with no reservations', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(7, 3)

    const result = await checkSiteAvailability(testData.site.id, check_in_date, check_out_date)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe(true)
    }
  })

  test('should return false for site with overlapping reservation', async () => {
    // Create a reservation for future dates
    const { check_in_date: existingCheckIn, check_out_date: existingCheckOut } =
      bookingDateRange(7, 3)

    await supabase.from('reservations').insert({
      id: testUUID(),
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest_id: testData.guest.id,
      confirmation_number: `TEST-${Date.now()}`,
      check_in_date: existingCheckIn,
      check_out_date: existingCheckOut,
      num_adults: 2,
      num_children: 0,
      num_pets: 0,
      num_vehicles: 1,
      total_amount: 150.0,
      paid_amount: 0.0,
      status: 'confirmed',
      payment_status: 'unpaid',
      source: 'online',
    })

    // Try to book overlapping dates
    const { check_in_date, check_out_date } = bookingDateRange(8, 3)

    const result = await checkSiteAvailability(testData.site.id, check_in_date, check_out_date)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe(false)
    }
  })

  test('should return false for site in maintenance status', async () => {
    // Update site to maintenance
    await supabase
      .from('sites')
      .update({ status: 'maintenance' })
      .eq('id', testData.site.id)

    const { check_in_date, check_out_date } = bookingDateRange(30, 3)

    const result = await checkSiteAvailability(testData.site.id, check_in_date, check_out_date)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe(false)
    }

    // Reset to available
    await supabase
      .from('sites')
      .update({ status: 'available' })
      .eq('id', testData.site.id)
  })

  test('should return error for non-existent site', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(7, 3)

    const result = await checkSiteAvailability(testUUID(), check_in_date, check_out_date)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('SITE_NOT_FOUND')
    }
  })

  test('should allow same-day turnover (checkout on same day as checkin)', async () => {
    // Create a reservation that checks out on a specific date
    const checkoutDate = futureDays(7)
    const checkinBeforeCheckout = futureDays(4)

    await supabase.from('reservations').insert({
      id: testUUID(),
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest_id: testData.guest.id,
      confirmation_number: `TEST-${Date.now()}-2`,
      check_in_date: checkinBeforeCheckout,
      check_out_date: checkoutDate,
      num_adults: 2,
      num_children: 0,
      num_pets: 0,
      num_vehicles: 1,
      total_amount: 150.0,
      paid_amount: 0.0,
      status: 'confirmed',
      payment_status: 'unpaid',
      source: 'online',
    })

    // Try to book starting on the checkout date
    const newCheckin = checkoutDate
    const newCheckout = futureDays(10)

    const result = await checkSiteAvailability(testData.site.id, newCheckin, newCheckout)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe(true) // Should be available
    }
  })
})

describe('searchAvailableSites', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
    sites: Site[]
    guest_id: string
  }

  beforeAll(async () => {
    const property_id = testPropertyId()
    const guest_id = testGuestId()

    // Create test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Campground Search',
      slug: 'test-campground-search-' + Date.now(),
      owner_id: testUUID(),
    })

    // Create test guest
    await supabase.from('guests').insert({
      id: guest_id,
      property_id,
      first_name: 'Test',
      last_name: 'Guest',
      email: `test-search-${Date.now()}@example.com`,
      phone: '555-0200',
    })

    // Create multiple sites with different types
    const sites: Partial<Site>[] = [
      {
        id: testSiteId(),
        property_id,
        site_number: '1',
        site_name: 'RV Site 1',
        site_type: 'rv',
        max_occupancy: 4,
        max_vehicles: 2,
        hookups: ['electric', 'water', 'sewer'],
        amenities: ['wifi'],
        base_price: 60.0,
        status: 'available',
        allow_pets: true,
        ada_accessible: false,
      },
      {
        id: testSiteId(),
        property_id,
        site_number: '2',
        site_name: 'Tent Site 1',
        site_type: 'tent',
        max_occupancy: 6,
        max_vehicles: 1,
        hookups: [],
        amenities: ['firepit'],
        base_price: 30.0,
        status: 'available',
        allow_pets: false,
        ada_accessible: false,
      },
      {
        id: testSiteId(),
        property_id,
        site_number: '3',
        site_name: 'Cabin 1',
        site_type: 'cabin',
        max_occupancy: 4,
        max_vehicles: 1,
        hookups: ['electric', 'water'],
        amenities: ['wifi', 'kitchen'],
        base_price: 120.0,
        status: 'available',
        allow_pets: false,
        ada_accessible: true,
      },
    ]

    const { data: insertedSites, error } = await supabase
      .from('sites')
      .insert(sites)
      .select()

    if (error) throw new Error(`Failed to create test sites: ${error.message}`)

    testData = {
      property_id,
      sites: insertedSites as Site[],
      guest_id,
    }
  })

  afterAll(async () => {
    await supabase.from('reservations').delete().eq('property_id', testData.property_id)
    await supabase.from('guests').delete().eq('property_id', testData.property_id)
    await supabase.from('sites').delete().eq('property_id', testData.property_id)
    await supabase.from('properties').delete().eq('id', testData.property_id)
  })

  test('should return all available sites when no filters applied', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(15, 3)

    const result = await searchAvailableSites({
      property_id: testData.property_id,
      check_in_date,
      check_out_date,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sites.length).toBe(3)
      expect(result.data.total_nights).toBe(3)
    }
  })

  test('should filter sites by type', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(15, 3)

    const result = await searchAvailableSites({
      property_id: testData.property_id,
      check_in_date,
      check_out_date,
      site_type: 'rv',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sites.length).toBe(1)
      expect(result.data.sites[0]!.site_type).toBe('rv')
    }
  })

  test('should filter sites by occupancy', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(15, 3)

    const result = await searchAvailableSites({
      property_id: testData.property_id,
      check_in_date,
      check_out_date,
      num_adults: 5, // Requires more than 4 capacity
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sites.length).toBe(1)
      expect(result.data.sites[0]!.max_occupancy).toBeGreaterThanOrEqual(5)
    }
  })

  test('should filter sites by amenities', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(15, 3)

    const result = await searchAvailableSites({
      property_id: testData.property_id,
      check_in_date,
      check_out_date,
      amenities: ['wifi'],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sites.length).toBeGreaterThan(0)
      result.data.sites.forEach((site) => {
        expect(site.amenities.wifi).toBe(true)
      })
    }
  })

  test('should exclude sites with overlapping reservations', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(20, 3)

    // Book the first site
    await supabase.from('reservations').insert({
      id: testUUID(),
      property_id: testData.property_id,
      site_id: testData.sites[0]!.id,
      guest_id: testData.guest_id,
      confirmation_number: `TEST-${Date.now()}`,
      check_in_date,
      check_out_date,
      num_adults: 2,
      num_children: 0,
      num_pets: 0,
      num_vehicles: 1,
      total_amount: 180.0,
      paid_amount: 0.0,
      status: 'confirmed',
      payment_status: 'unpaid',
      source: 'online',
    })

    const result = await searchAvailableSites({
      property_id: testData.property_id,
      check_in_date,
      check_out_date,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sites.length).toBe(2) // Should exclude the booked site
      expect(result.data.sites.some((site) => site.id === testData.sites[0]!.id)).toBe(false)
    }
  })

  test('should return empty array for past dates', async () => {
    const check_in_date = pastDays(5)
    const check_out_date = pastDays(2)

    const result = await searchAvailableSites({
      property_id: testData.property_id,
      check_in_date,
      check_out_date,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_DATE_RANGE')
    }
  })
})

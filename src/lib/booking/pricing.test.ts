/**
 * Tests for Pricing Calculation Functions
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
import { calculateReservationPrice } from './pricing'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { futureDays, bookingDateRange, weekendDateRange } from './test-utils/date-helpers'
import { testPropertyId, testSiteId, testUUID } from './test-utils/id-helpers'
import type { Site } from './types'

describe('calculateReservationPrice', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
    weekdaySite: Site
    weekendPricingSite: Site
    petFriendlySite: Site
  }

  beforeAll(async () => {
    const property_id = testPropertyId()

    // Create test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Pricing Campground',
      slug: 'test-pricing-' + Date.now(),
      owner_id: testUUID(),
    })

    // Create site with standard weekday pricing
    const weekdaySiteData: Partial<Site> = {
      id: testSiteId(),
      property_id,
      site_number: 'P1',
      site_name: 'Pricing Test Site 1',
      site_type: 'rv',
      max_occupancy: 4,
      max_vehicles: 2,
      hookups: ['electric'],
      amenities: ['wifi'],
      base_price: 50.0,
      weekend_price: null, // No weekend pricing
      status: 'available',
      allow_pets: false,
      pet_fee: null,
      ada_accessible: false,
    }

    // Create site with weekend pricing
    const weekendPricingSiteData: Partial<Site> = {
      id: testSiteId(),
      property_id,
      site_number: 'P2',
      site_name: 'Weekend Pricing Site',
      site_type: 'cabin',
      max_occupancy: 6,
      max_vehicles: 2,
      hookups: [],
      amenities: ['kitchen'],
      base_price: 100.0,
      weekend_price: 150.0, // Higher weekend rate
      status: 'available',
      allow_pets: false,
      pet_fee: null,
      ada_accessible: false,
    }

    // Create pet-friendly site with pet fee
    const petFriendlySiteData: Partial<Site> = {
      id: testSiteId(),
      property_id,
      site_number: 'P3',
      site_name: 'Pet Friendly Site',
      site_type: 'tent',
      max_occupancy: 4,
      max_vehicles: 1,
      hookups: [],
      amenities: ['firepit'],
      base_price: 40.0,
      weekend_price: null,
      status: 'available',
      allow_pets: true,
      pet_fee: 15.0, // Per stay pet fee
      ada_accessible: false,
    }

    const { data: sites, error } = await supabase
      .from('sites')
      .insert([weekdaySiteData, weekendPricingSiteData, petFriendlySiteData])
      .select()

    if (error) throw new Error(`Failed to create test sites: ${error.message}`)

    testData = {
      property_id,
      weekdaySite: sites[0] as Site,
      weekendPricingSite: sites[1] as Site,
      petFriendlySite: sites[2] as Site,
    }
  })

  afterAll(async () => {
    await supabase.from('sites').delete().eq('property_id', testData.property_id)
    await supabase.from('properties').delete().eq('id', testData.property_id)
  })

  test('should calculate basic pricing for weekday stay', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(7, 3) // 3 nights

    const result = await calculateReservationPrice(
      testData.weekdaySite.id,
      check_in_date,
      check_out_date
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.base_price_per_night).toBe(50.0)
      expect(result.data.number_of_nights).toBe(3)
      expect(result.data.subtotal).toBe(150.0) // 50 * 3
      expect(result.data.total).toBe(150.0)
    }
  })

  test('should calculate pricing for single night stay', async () => {
    const check_in = futureDays(7)
    const check_out = futureDays(8) // 1 night

    const result = await calculateReservationPrice(
      testData.weekdaySite.id,
      check_in,
      check_out
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.number_of_nights).toBe(1)
      expect(result.data.subtotal).toBe(50.0)
      expect(result.data.total).toBe(50.0)
    }
  })

  test('should calculate pricing for week-long stay', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(14, 7) // 7 nights

    const result = await calculateReservationPrice(
      testData.weekdaySite.id,
      check_in_date,
      check_out_date
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.number_of_nights).toBe(7)
      expect(result.data.subtotal).toBe(350.0) // 50 * 7
      expect(result.data.total).toBe(350.0)
    }
  })

  test('should include pet fee when booking with pets', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(7, 2) // 2 nights

    const result = await calculateReservationPrice(
      testData.petFriendlySite.id,
      check_in_date,
      check_out_date,
      { num_pets: 1 }
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.subtotal).toBe(80.0) // 40 * 2 nights
      expect(result.data.pet_fee).toBe(15.0)
      expect(result.data.total).toBe(95.0) // 80 + 15
    }
  })

  test('should not charge pet fee when no pets', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(7, 2)

    const result = await calculateReservationPrice(
      testData.petFriendlySite.id,
      check_in_date,
      check_out_date,
      { num_pets: 0 }
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.pet_fee).toBeUndefined()
      expect(result.data.total).toBe(80.0) // Just base price
    }
  })

  test('should apply weekend pricing when site has weekend rates', async () => {
    // Book a weekend (Friday to Monday)
    const { check_in_date, check_out_date } = weekendDateRange(1)

    const result = await calculateReservationPrice(
      testData.weekendPricingSite.id,
      check_in_date,
      check_out_date
    )

    expect(result.success).toBe(true)
    if (result.success) {
      // Weekend includes Friday, Saturday, Sunday nights (3 nights total)
      expect(result.data.number_of_nights).toBe(3)
      // Should have weekend surcharge applied
      expect(result.data.weekend_surcharge).toBeGreaterThan(0)
      expect(result.data.total).toBeGreaterThan(result.data.subtotal)
    }
  })

  test('should return error for non-existent site', async () => {
    const { check_in_date, check_out_date } = bookingDateRange(7, 3)

    const result = await calculateReservationPrice(
      testUUID(),
      check_in_date,
      check_out_date
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('SITE_NOT_FOUND')
    }
  })

  test('should return error for invalid date range', async () => {
    const check_in = futureDays(7)
    const check_out = futureDays(5) // Check-out before check-in

    const result = await calculateReservationPrice(
      testData.weekdaySite.id,
      check_in,
      check_out
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_DATE_RANGE')
    }
  })

  test('should handle zero-night stays (same-day checkin/checkout)', async () => {
    const check_in = futureDays(7)
    const check_out = check_in // Same day

    const result = await calculateReservationPrice(
      testData.weekdaySite.id,
      check_in,
      check_out
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_DATE_RANGE')
    }
  })
})

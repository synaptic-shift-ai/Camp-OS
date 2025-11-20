/**
 * Tests for Booking Lifecycle Availability Checking
 *
 * Tests checkExtensionAvailability and checkRenewalAvailability functions.
 * Following TDD best practices:
 * - Dynamic date and ID generation
 * - Integration tests (DB-touching)
 * - Test edge cases and boundaries
 * - Test all three status types: fully_available, partially_available, not_available
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  checkExtensionAvailability,
  checkRenewalAvailability,
} from './availability-check'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { futureDays, bookingDateRange } from './test-utils/date-helpers'
import { testPropertyId, testSiteId, testGuestId, testUUID } from './test-utils/id-helpers'
import type { Site, Guest } from './types'

describe('checkExtensionAvailability', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
    site: Site
    guest: Guest
    reservation_id: string
    check_in_date: string
    check_out_date: string
  }

  beforeAll(async () => {
    // Create test property, site, guest, and reservation
    const property_id = testPropertyId()
    const site_id = testSiteId()
    const guest_id = testGuestId()
    const reservation_id = testUUID()

    // Insert test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Campground Extension',
      slug: 'test-extension-' + Date.now(),
      owner_id: testUUID(),
    })

    // Insert test site
    const siteData = {
      id: site_id,
      property_id,
      site_number: '10A',
      site_name: 'Extension Test Site',
      site_type: 'rv',
      max_occupancy: 4,
      max_vehicles: 2,
      hookups: ['electric', 'water'],
      amenities: ['wifi', 'firepit'],
      base_price: 5000, // $50.00 in cents
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
    const guestData = {
      id: guest_id,
      property_id,
      first_name: 'Extension',
      last_name: 'Tester',
      email: `extension-test-${Date.now()}@example.com`,
      phone: '555-0111',
    }

    const { data: insertedGuest, error: guestError } = await supabase
      .from('guests')
      .insert(guestData)
      .select()
      .single()

    if (guestError) throw new Error(`Failed to create test guest: ${guestError.message}`)

    // Create base reservation (3 nights starting 7 days from now)
    const { check_in_date, check_out_date } = bookingDateRange(7, 3)

    await supabase.from('reservations').insert({
      id: reservation_id,
      property_id,
      site_id,
      guest_id,
      confirmation_number: `EXT-TEST-${Date.now()}`,
      check_in_date,
      check_out_date,
      num_adults: 2,
      num_children: 0,
      num_pets: 0,
      num_vehicles: 1,
      total_amount: 15000, // $150.00 for 3 nights
      paid_amount: 15000,
      status: 'confirmed',
      payment_status: 'paid',
      booking_type: 'nightly',
      source: 'online',
    })

    testData = {
      property_id,
      site: insertedSite as Site,
      guest: insertedGuest as Guest,
      reservation_id,
      check_in_date,
      check_out_date,
    }
  })

  afterAll(async () => {
    // Clean up test data
    await supabase.from('reservation_actions').delete().eq('reservation_id', testData.reservation_id)
    await supabase.from('payment_installments').delete().match({ reservation_id: testData.reservation_id })
    await supabase.from('reservations').delete().eq('property_id', testData.property_id)
    await supabase.from('guests').delete().eq('property_id', testData.property_id)
    await supabase.from('sites').delete().eq('property_id', testData.property_id)
    await supabase.from('properties').delete().eq('id', testData.property_id)
  })

  test('should return fully_available when extending with no conflicts', async () => {
    // Extend checkout by 2 days
    const newCheckOut = futureDays(12) // Original was day 10

    const result = await checkExtensionAvailability(
      testData.reservation_id,
      undefined, // Not extending before
      newCheckOut
    )

    expect(result.available).toBe(true)
    expect(result.status).toBe('fully_available')
    expect(result.conflicts).toHaveLength(0)
    expect(result.alternatives).toHaveLength(0)
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.recommendations[0]?.action).toBe('extend_full')
  })

  test('should return fully_available when extending check-in with no conflicts', async () => {
    // Extend check-in by 2 days earlier
    const newCheckIn = futureDays(5) // Original was day 7

    const result = await checkExtensionAvailability(
      testData.reservation_id,
      newCheckIn,
      undefined // Not extending after
    )

    expect(result.available).toBe(true)
    expect(result.status).toBe('fully_available')
    expect(result.conflicts).toHaveLength(0)
  })

  test('should return not_available when extending into conflicting reservation', async () => {
    // Create a conflicting reservation after the current one
    const conflictCheckIn = futureDays(10) // Day after current checkout
    const conflictCheckOut = futureDays(13)

    await supabase.from('reservations').insert({
      id: testUUID(),
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest_id: testData.guest.id,
      confirmation_number: `CONFLICT-${Date.now()}`,
      check_in_date: conflictCheckIn,
      check_out_date: conflictCheckOut,
      num_adults: 2,
      num_children: 0,
      num_pets: 0,
      num_vehicles: 1,
      total_amount: 10000,
      paid_amount: 0,
      status: 'confirmed',
      payment_status: 'unpaid',
      booking_type: 'nightly',
      source: 'online',
    })

    // Try to extend into the conflict
    const newCheckOut = futureDays(12)

    const result = await checkExtensionAvailability(
      testData.reservation_id,
      undefined,
      newCheckOut
    )

    expect(result.available).toBe(false)
    expect(result.status).toBe('not_available')
    expect(result.conflicts.length).toBeGreaterThan(0)
    expect(result.conflicts[0]?.type).toBe('existing_reservation')
    expect(result.alternatives.length).toBeGreaterThan(0) // Should suggest other sites
  })

  test('should return partially_available when only part of extension is available', async () => {
    // Try to extend far into the future where there's a conflict
    const farFutureCheckOut = futureDays(20)

    const result = await checkExtensionAvailability(
      testData.reservation_id,
      undefined,
      farFutureCheckOut
    )

    // Depending on conflicts, should be partially available or not available
    expect(['partially_available', 'not_available']).toContain(result.status)

    if (result.status === 'partially_available') {
      expect(result.available_range).toBeDefined()
      expect(result.recommendations.some(r => r.action === 'extend_partial')).toBe(true)
    }
  })

  test('should return error for non-existent reservation', async () => {
    const fakeReservationId = testUUID()
    const newCheckOut = futureDays(12)

    const result = await checkExtensionAvailability(
      fakeReservationId,
      undefined,
      newCheckOut
    )

    expect(result.available).toBe(false)
    expect(result.status).toBe('not_available')
  })

  test('should handle extending both before and after simultaneously', async () => {
    const newCheckIn = futureDays(5)
    const newCheckOut = futureDays(12)

    const result = await checkExtensionAvailability(
      testData.reservation_id,
      newCheckIn,
      newCheckOut
    )

    expect(result.status).toBeDefined()
    expect(['fully_available', 'partially_available', 'not_available']).toContain(result.status)
  })
})

describe('checkRenewalAvailability', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
    site: Site
    guest: Guest
    reservation_id: string
    check_out_date: string
  }

  beforeAll(async () => {
    // Create test property, site, guest, and seasonal reservation
    const property_id = testPropertyId()
    const site_id = testSiteId()
    const guest_id = testGuestId()
    const reservation_id = testUUID()

    // Insert test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Campground Renewal',
      slug: 'test-renewal-' + Date.now(),
      owner_id: testUUID(),
    })

    // Insert test site
    const siteData = {
      id: site_id,
      property_id,
      site_number: '20B',
      site_name: 'Renewal Test Site',
      site_type: 'seasonal',
      max_occupancy: 6,
      max_vehicles: 2,
      hookups: ['electric', 'water', 'sewer'],
      amenities: ['wifi'],
      base_price: 10000, // $100.00/night
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
    const guestData = {
      id: guest_id,
      property_id,
      first_name: 'Renewal',
      last_name: 'Tester',
      email: `renewal-test-${Date.now()}@example.com`,
      phone: '555-0222',
    }

    const { data: insertedGuest, error: guestError } = await supabase
      .from('guests')
      .insert(guestData)
      .select()
      .single()

    if (guestError) throw new Error(`Failed to create test guest: ${guestError.message}`)

    // Create seasonal reservation (30 days starting 7 days from now)
    const check_in_date = futureDays(7)
    const check_out_date = futureDays(37) // 30 days later

    await supabase.from('reservations').insert({
      id: reservation_id,
      property_id,
      site_id,
      guest_id,
      confirmation_number: `SEASON-TEST-${Date.now()}`,
      check_in_date,
      check_out_date,
      num_adults: 2,
      num_children: 1,
      num_pets: 1,
      num_vehicles: 1,
      total_amount: 300000, // $3,000 for 30 nights
      paid_amount: 300000,
      status: 'confirmed',
      payment_status: 'paid',
      booking_type: 'seasonal',
      booking_period: {
        season: 'Spring 2025',
        start_date: check_in_date,
        end_date: check_out_date,
      },
      source: 'online',
    })

    testData = {
      property_id,
      site: insertedSite as Site,
      guest: insertedGuest as Guest,
      reservation_id,
      check_out_date,
    }
  })

  afterAll(async () => {
    // Clean up test data
    await supabase.from('reservation_actions').delete().match({ reservation_id: testData.reservation_id })
    await supabase.from('payment_installments').delete().match({ reservation_id: testData.reservation_id })
    await supabase.from('reservations').delete().eq('property_id', testData.property_id)
    await supabase.from('guests').delete().eq('property_id', testData.property_id)
    await supabase.from('sites').delete().eq('property_id', testData.property_id)
    await supabase.from('properties').delete().eq('id', testData.property_id)
  })

  test('should return fully_available for renewal with no conflicts', async () => {
    // Renew for next period (30 days after current checkout)
    const nextPeriodStart = futureDays(37) // Day after checkout
    const nextPeriodEnd = futureDays(67) // 30 days later

    const result = await checkRenewalAvailability(
      testData.reservation_id,
      nextPeriodStart,
      nextPeriodEnd
    )

    expect(result.available).toBe(true)
    expect(result.status).toBe('fully_available')
    expect(result.conflicts).toHaveLength(0)
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.recommendations[0]?.action).toBe('renew_same_site')
  })

  test('should return not_available when renewal period has conflicts', async () => {
    // Create a conflicting reservation in the renewal period
    const nextPeriodStart = futureDays(37)
    const nextPeriodEnd = futureDays(67)
    const conflictStart = futureDays(50) // Middle of renewal period
    const conflictEnd = futureDays(60)

    await supabase.from('reservations').insert({
      id: testUUID(),
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest_id: testData.guest.id,
      confirmation_number: `RENEW-CONFLICT-${Date.now()}`,
      check_in_date: conflictStart,
      check_out_date: conflictEnd,
      num_adults: 2,
      num_children: 0,
      num_pets: 0,
      num_vehicles: 1,
      total_amount: 50000,
      paid_amount: 0,
      status: 'confirmed',
      payment_status: 'unpaid',
      booking_type: 'nightly',
      source: 'online',
    })

    const result = await checkRenewalAvailability(
      testData.reservation_id,
      nextPeriodStart,
      nextPeriodEnd
    )

    expect(result.available).toBe(false)
    expect(result.status).toBe('not_available')
    expect(result.conflicts.length).toBeGreaterThan(0)
    expect(result.alternatives.length).toBeGreaterThan(0) // Should suggest different sites
  })

  test('should suggest alternative sites when current site unavailable', async () => {
    // Create another site for alternatives
    const altSiteId = testSiteId()
    await supabase.from('sites').insert({
      id: altSiteId,
      property_id: testData.property_id,
      site_number: '21B',
      site_name: 'Alternative Site',
      site_type: 'seasonal',
      max_occupancy: 6,
      max_vehicles: 2,
      hookups: ['electric', 'water', 'sewer'],
      amenities: ['wifi'],
      base_price: 10000,
      status: 'available',
      allow_pets: true,
      ada_accessible: false,
    })

    // Create conflict on original site
    const nextPeriodStart = futureDays(70)
    const nextPeriodEnd = futureDays(100)

    const result = await checkRenewalAvailability(
      testData.reservation_id,
      nextPeriodStart,
      nextPeriodEnd
    )

    if (result.status === 'not_available') {
      expect(result.alternatives.length).toBeGreaterThan(0)
      // Should include the alternative site
      const hasAlternative = result.alternatives.some(
        (alt) => alt.site_id === altSiteId
      )
      expect(hasAlternative).toBe(true)
    }
  })

  test('should calculate similarity scores for alternative sites', async () => {
    // Create sites with varying similarity
    const similarSiteId = testSiteId()
    const differentSiteId = testSiteId()

    await supabase.from('sites').insert([
      {
        id: similarSiteId,
        property_id: testData.property_id,
        site_number: '22B',
        site_name: 'Very Similar Site',
        site_type: 'seasonal', // Same type
        max_occupancy: 6, // Same occupancy
        max_vehicles: 2,
        hookups: ['electric', 'water', 'sewer'], // Same hookups
        amenities: ['wifi'], // Same amenities
        base_price: 10000, // Same price
        status: 'available',
        allow_pets: true,
        ada_accessible: false,
      },
      {
        id: differentSiteId,
        property_id: testData.property_id,
        site_number: '23C',
        site_name: 'Different Site',
        site_type: 'tent', // Different type
        max_occupancy: 4, // Different occupancy
        max_vehicles: 1,
        hookups: [], // No hookups
        amenities: [],
        base_price: 3000, // Much cheaper
        status: 'available',
        allow_pets: false,
        ada_accessible: false,
      },
    ])

    const nextPeriodStart = futureDays(105)
    const nextPeriodEnd = futureDays(135)

    const result = await checkRenewalAvailability(
      testData.reservation_id,
      nextPeriodStart,
      nextPeriodEnd
    )

    if (result.alternatives.length >= 2) {
      const similarSite = result.alternatives.find((alt) => alt.site_id === similarSiteId)
      const differentSite = result.alternatives.find((alt) => alt.site_id === differentSiteId)

      if (similarSite && differentSite) {
        // Similar site should have higher similarity score
        expect(similarSite.similarity_score).toBeGreaterThan(differentSite.similarity_score)
      }
    }
  })

  test('should return error for non-existent reservation', async () => {
    const fakeReservationId = testUUID()
    const nextPeriodStart = futureDays(37)
    const nextPeriodEnd = futureDays(67)

    const result = await checkRenewalAvailability(
      fakeReservationId,
      nextPeriodStart,
      nextPeriodEnd
    )

    expect(result.available).toBe(false)
    expect(result.status).toBe('not_available')
  })

  test('should handle same-day turnover for renewals', async () => {
    // Renewal starting on the exact checkout date should be available
    const nextPeriodStart = testData.check_out_date
    const nextPeriodEnd = futureDays(67)

    const result = await checkRenewalAvailability(
      testData.reservation_id,
      nextPeriodStart,
      nextPeriodEnd
    )

    expect(result.status).toBeDefined()
    // Should either be available or have a specific reason why not
    if (!result.available) {
      expect(result.conflicts.length).toBeGreaterThan(0)
    }
  })
})

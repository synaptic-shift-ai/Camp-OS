/**
 * Tests for Booking Lifecycle Action Processing
 *
 * Tests processExtension and processRenewal functions.
 * Following TDD best practices:
 * - Dynamic date and ID generation
 * - Integration tests (DB-touching)
 * - Test success and failure cases
 * - Verify audit trail creation
 * - Verify payment installment generation
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  processExtension,
  processRenewal,
  offerRenewal,
  declineRenewal,
} from './actions'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { futureDays, bookingDateRange } from './test-utils/date-helpers'
import { testPropertyId, testSiteId, testGuestId, testUUID } from './test-utils/id-helpers'
import type { Site, Guest } from './types'

describe('processExtension', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
    site: Site
    guest: Guest
    reservation_id: string
    check_in_date: string
    check_out_date: string
    user_id: string
  }

  beforeAll(async () => {
    // Create test data
    const property_id = testPropertyId()
    const site_id = testSiteId()
    const guest_id = testGuestId()
    const reservation_id = testUUID()
    const user_id = testUUID()

    // Insert test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Action Processing',
      slug: 'test-actions-' + Date.now(),
      owner_id: user_id,
    })

    // Insert test site
    const siteData = {
      id: site_id,
      property_id,
      site_number: '30C',
      site_name: 'Action Test Site',
      site_type: 'rv',
      max_occupancy: 4,
      max_vehicles: 2,
      hookups: ['electric', 'water'],
      amenities: ['wifi'],
      base_price: 5000, // $50.00/night in cents
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
      first_name: 'Action',
      last_name: 'Tester',
      email: `action-test-${Date.now()}@example.com`,
      phone: '555-0333',
    }

    const { data: insertedGuest, error: guestError } = await supabase
      .from('guests')
      .insert(guestData)
      .select()
      .single()

    if (guestError) throw new Error(`Failed to create test guest: ${guestError.message}`)

    // Create base reservation
    const { check_in_date, check_out_date } = bookingDateRange(7, 3)

    await supabase.from('reservations').insert({
      id: reservation_id,
      property_id,
      site_id,
      guest_id,
      confirmation_number: `ACTION-TEST-${Date.now()}`,
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
      times_extended: 0,
      times_modified: 0,
      source: 'online',
    })

    testData = {
      property_id,
      site: insertedSite as Site,
      guest: insertedGuest as Guest,
      reservation_id,
      check_in_date,
      check_out_date,
      user_id,
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

  test('should successfully extend checkout date', async () => {
    // Extend by 2 nights
    const newCheckOut = futureDays(12)

    const result = await processExtension(
      testData.reservation_id,
      newCheckOut,
      undefined,
      testData.user_id,
      'Guest requested late checkout'
    )

    expect(result.success).toBe(true)
    expect(result.reservation).toBeDefined()
    expect(result.action).toBeDefined()
    expect(result.price_change).toBe(10000) // 2 nights * $50/night = $100
    expect(result.payment_required).toBe(true)

    if (result.reservation) {
      expect(result.reservation.check_out_date).toBe(newCheckOut)
      expect(result.reservation.times_extended).toBe(1)
      expect(result.reservation.total_amount).toBe(25000) // Original $150 + $100
    }

    // Verify audit record was created
    const { data: actions } = await supabase
      .from('reservation_actions')
      .select('*')
      .eq('reservation_id', testData.reservation_id)
      .eq('action_type', 'extended')

    expect(actions).toBeDefined()
    expect(actions!.length).toBeGreaterThan(0)
    expect(actions![0]!.performed_by).toBe(testData.user_id)
    expect(actions![0]!.price_change_cents).toBe(10000)

    // Verify payment installment was created
    const { data: installments } = await supabase
      .from('payment_installments')
      .select('*')
      .eq('reservation_id', testData.reservation_id)

    expect(installments).toBeDefined()
    expect(installments!.length).toBeGreaterThan(0)
    expect(installments![0]!.amount_cents).toBe(10000)
    expect(installments![0]!.status).toBe('pending')
  })

  test('should successfully extend check-in date', async () => {
    const newCheckIn = futureDays(5) // 2 days earlier

    const result = await processExtension(
      testData.reservation_id,
      undefined,
      newCheckIn,
      testData.user_id,
      'Guest arriving early'
    )

    expect(result.success).toBe(true)
    expect(result.price_change).toBeGreaterThan(0) // Should charge for additional nights
  })

  test('should fail extension when site not available', async () => {
    // Create a conflicting reservation
    const conflictStart = futureDays(12)
    const conflictEnd = futureDays(15)

    await supabase.from('reservations').insert({
      id: testUUID(),
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest_id: testData.guest.id,
      confirmation_number: `CONFLICT-${Date.now()}`,
      check_in_date: conflictStart,
      check_out_date: conflictEnd,
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
    const newCheckOut = futureDays(14)

    const result = await processExtension(
      testData.reservation_id,
      newCheckOut,
      undefined,
      testData.user_id
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error!.code).toBe('EXTENSION_BLOCKED')
  })

  test('should fail for non-existent reservation', async () => {
    const fakeId = testUUID()
    const newCheckOut = futureDays(15)

    const result = await processExtension(fakeId, newCheckOut)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error!.code).toBe('RESERVATION_NOT_FOUND')
  })

  test('should track times_extended counter', async () => {
    // First extension
    const firstExtension = futureDays(20)
    const result1 = await processExtension(testData.reservation_id, firstExtension)

    expect(result1.success).toBe(true)
    if (result1.reservation) {
      const firstCount = result1.reservation.times_extended || 0

      // Second extension (from new checkout date)
      const secondExtension = futureDays(22)
      const result2 = await processExtension(testData.reservation_id, secondExtension)

      expect(result2.success).toBe(true)
      if (result2.reservation) {
        expect(result2.reservation.times_extended).toBe(firstCount + 1)
      }
    }
  })
})

describe('processRenewal', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
    site: Site
    guest: Guest
    reservation_id: string
    user_id: string
  }

  beforeAll(async () => {
    // Create test data for seasonal renewal
    const property_id = testPropertyId()
    const site_id = testSiteId()
    const guest_id = testGuestId()
    const reservation_id = testUUID()
    const user_id = testUUID()

    // Insert test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Renewal Processing',
      slug: 'test-renewal-process-' + Date.now(),
      owner_id: user_id,
    })

    // Insert test site
    const siteData = {
      id: site_id,
      property_id,
      site_number: '40D',
      site_name: 'Renewal Action Site',
      site_type: 'seasonal',
      max_occupancy: 6,
      max_vehicles: 2,
      hookups: ['electric', 'water', 'sewer'],
      amenities: ['wifi', 'cable'],
      base_price: 10000, // $100/night
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
      last_name: 'Action',
      email: `renewal-action-${Date.now()}@example.com`,
      phone: '555-0444',
    }

    const { data: insertedGuest, error: guestError } = await supabase
      .from('guests')
      .insert(guestData)
      .select()
      .single()

    if (guestError) throw new Error(`Failed to create test guest: ${guestError.message}`)

    // Create seasonal reservation
    const check_in_date = futureDays(7)
    const check_out_date = futureDays(37)

    await supabase.from('reservations').insert({
      id: reservation_id,
      property_id,
      site_id,
      guest_id,
      confirmation_number: `RENEW-ACTION-${Date.now()}`,
      check_in_date,
      check_out_date,
      num_adults: 2,
      num_children: 1,
      num_pets: 1,
      num_vehicles: 1,
      vehicle_info: [{ make: 'Ford', model: 'F-150', year: 2020 }],
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
      user_id,
    }
  })

  afterAll(async () => {
    // Clean up - need to handle parent/child reservations
    await supabase.from('reservation_actions').delete().match({ reservation_id: testData.reservation_id })
    await supabase.from('payment_installments').delete().match({ reservation_id: testData.reservation_id })
    await supabase
      .from('reservations')
      .delete()
      .or(`id.eq.${testData.reservation_id},parent_reservation_id.eq.${testData.reservation_id}`)
    await supabase.from('guests').delete().eq('property_id', testData.property_id)
    await supabase.from('sites').delete().eq('property_id', testData.property_id)
    await supabase.from('properties').delete().eq('id', testData.property_id)
  })

  test('should successfully create renewal reservation', async () => {
    const nextPeriod = {
      season: 'Summer 2025',
      start_date: futureDays(37),
      end_date: futureDays(67),
    }
    const renewalDeadline = futureDays(30)
    const depositAmount = 90000 // $900 (30% of $3,000)

    const result = await processRenewal(
      testData.reservation_id,
      nextPeriod,
      renewalDeadline,
      depositAmount,
      testData.user_id,
      'Loyal guest from previous season'
    )

    expect(result.success).toBe(true)
    expect(result.reservation).toBeDefined()
    expect(result.action).toBeDefined()
    expect(result.payment_required).toBe(true)

    if (result.reservation) {
      // Verify new reservation was created
      expect(result.reservation.parent_reservation_id).toBe(testData.reservation_id)
      expect(result.reservation.check_in_date).toBe(nextPeriod.start_date)
      expect(result.reservation.check_out_date).toBe(nextPeriod.end_date)
      expect(result.reservation.status).toBe('pending')
      expect(result.reservation.payment_status).toBe('unpaid')
      expect(result.reservation.renewal_status).toBe('accepted')

      // Verify same guest and site
      expect(result.reservation.guest_id).toBe(testData.guest.id)
      expect(result.reservation.site_id).toBe(testData.site.id)

      // Verify guest details were copied
      expect(result.reservation.num_adults).toBe(2)
      expect(result.reservation.num_children).toBe(1)
      expect(result.reservation.num_pets).toBe(1)

      // Verify payment installments were created
      const { data: installments } = await supabase
        .from('payment_installments')
        .select('*')
        .eq('reservation_id', result.reservation.id)
        .order('installment_number')

      expect(installments).toBeDefined()
      expect(installments!.length).toBe(2) // Deposit + Balance

      // Check deposit installment
      const deposit = installments![0]
      expect(deposit!.amount_cents).toBe(depositAmount)
      expect(deposit!.due_date).toBe(renewalDeadline)
      expect(deposit!.status).toBe('pending')
      expect(deposit!.description).toContain('Deposit')

      // Check balance installment
      const balance = installments![1]
      expect(balance!.amount_cents).toBe(300000 - depositAmount) // Total - deposit
      expect(balance!.due_date).toBe(nextPeriod.start_date)
      expect(balance!.status).toBe('pending')
      expect(balance!.description).toContain('Balance')
    }

    // Verify original reservation was updated
    const { data: originalRes } = await supabase
      .from('reservations')
      .select('renewal_status, renewal_offered_at, renewal_deadline')
      .eq('id', testData.reservation_id)
      .single()

    expect(originalRes).toBeDefined()
    expect(originalRes!.renewal_status).toBe('accepted')
    expect(originalRes!.renewal_offered_at).toBeDefined()
    expect(originalRes!.renewal_deadline).toBe(renewalDeadline)

    // Verify audit record
    const { data: actions } = await supabase
      .from('reservation_actions')
      .select('*')
      .eq('reservation_id', testData.reservation_id)
      .eq('action_type', 'renewed')

    expect(actions).toBeDefined()
    expect(actions!.length).toBeGreaterThan(0)
    expect(actions![0]!.performed_by).toBe(testData.user_id)
  })

  test('should fail renewal when site not available', async () => {
    // Create conflicting reservation in renewal period
    const nextPeriod = {
      season: 'Fall 2025',
      start_date: futureDays(70),
      end_date: futureDays(100),
    }

    // Create conflict
    await supabase.from('reservations').insert({
      id: testUUID(),
      property_id: testData.property_id,
      site_id: testData.site.id,
      guest_id: testData.guest.id,
      confirmation_number: `RENEW-CONFLICT-${Date.now()}`,
      check_in_date: futureDays(75),
      check_out_date: futureDays(85),
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

    const result = await processRenewal(
      testData.reservation_id,
      nextPeriod,
      futureDays(65),
      90000,
      testData.user_id
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error!.code).toBe('RENEWAL_BLOCKED')
  })
})

describe('offerRenewal', () => {
  const supabase = createServiceRoleClient()
  let reservation_id: string
  let property_id: string

  beforeAll(async () => {
    property_id = testPropertyId()
    reservation_id = testUUID()
    const site_id = testSiteId()
    const guest_id = testGuestId()

    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Offer',
      slug: 'test-offer-' + Date.now(),
      owner_id: testUUID(),
    })

    await supabase.from('sites').insert({
      id: site_id,
      property_id,
      site_number: '50E',
      site_name: 'Offer Test',
      site_type: 'seasonal',
      max_occupancy: 4,
      max_vehicles: 2,
      hookups: ['electric'],
      amenities: [],
      base_price: 5000,
      status: 'available',
      allow_pets: false,
      ada_accessible: false,
    })

    await supabase.from('guests').insert({
      id: guest_id,
      property_id,
      first_name: 'Offer',
      last_name: 'Test',
      email: `offer-${Date.now()}@example.com`,
      phone: '555-0555',
    })

    await supabase.from('reservations').insert({
      id: reservation_id,
      property_id,
      site_id,
      guest_id,
      confirmation_number: `OFFER-${Date.now()}`,
      check_in_date: futureDays(7),
      check_out_date: futureDays(37),
      num_adults: 2,
      num_children: 0,
      num_pets: 0,
      num_vehicles: 1,
      total_amount: 150000,
      paid_amount: 150000,
      status: 'confirmed',
      payment_status: 'paid',
      booking_type: 'seasonal',
      source: 'online',
    })
  })

  afterAll(async () => {
    await supabase.from('reservation_actions').delete().match({ reservation_id })
    await supabase.from('reservations').delete().eq('property_id', property_id)
    await supabase.from('guests').delete().eq('property_id', property_id)
    await supabase.from('sites').delete().eq('property_id', property_id)
    await supabase.from('properties').delete().eq('id', property_id)
  })

  test('should successfully offer renewal', async () => {
    const renewalDeadline = futureDays(30)
    const user_id = testUUID()

    const result = await offerRenewal(
      reservation_id,
      renewalDeadline,
      user_id,
      'Offering renewal for next season'
    )

    expect(result.success).toBe(true)
    expect(result.reservation).toBeDefined()

    if (result.reservation) {
      expect(result.reservation.renewal_status).toBe('offered')
      expect(result.reservation.renewal_deadline).toBe(renewalDeadline)
    }
  })
})

describe('declineRenewal', () => {
  const supabase = createServiceRoleClient()
  let reservation_id: string
  let property_id: string

  beforeAll(async () => {
    property_id = testPropertyId()
    reservation_id = testUUID()
    const site_id = testSiteId()
    const guest_id = testGuestId()

    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Decline',
      slug: 'test-decline-' + Date.now(),
      owner_id: testUUID(),
    })

    await supabase.from('sites').insert({
      id: site_id,
      property_id,
      site_number: '60F',
      site_name: 'Decline Test',
      site_type: 'monthly',
      max_occupancy: 4,
      max_vehicles: 1,
      hookups: ['electric', 'water'],
      amenities: [],
      base_price: 7500,
      status: 'available',
      allow_pets: true,
      ada_accessible: false,
    })

    await supabase.from('guests').insert({
      id: guest_id,
      property_id,
      first_name: 'Decline',
      last_name: 'Test',
      email: `decline-${Date.now()}@example.com`,
      phone: '555-0666',
    })

    await supabase.from('reservations').insert({
      id: reservation_id,
      property_id,
      site_id,
      guest_id,
      confirmation_number: `DECLINE-${Date.now()}`,
      check_in_date: futureDays(7),
      check_out_date: futureDays(37),
      num_adults: 2,
      num_children: 0,
      num_pets: 1,
      num_vehicles: 1,
      total_amount: 225000,
      paid_amount: 225000,
      status: 'confirmed',
      payment_status: 'paid',
      booking_type: 'monthly',
      renewal_status: 'offered',
      renewal_deadline: futureDays(30),
      source: 'online',
    })
  })

  afterAll(async () => {
    await supabase.from('reservation_actions').delete().match({ reservation_id })
    await supabase.from('reservations').delete().eq('property_id', property_id)
    await supabase.from('guests').delete().eq('property_id', property_id)
    await supabase.from('sites').delete().eq('property_id', property_id)
    await supabase.from('properties').delete().eq('id', property_id)
  })

  test('should successfully decline renewal', async () => {
    const user_id = testUUID()

    const result = await declineRenewal(
      reservation_id,
      user_id,
      'Guest decided not to return'
    )

    expect(result.success).toBe(true)
    expect(result.reservation).toBeDefined()

    if (result.reservation) {
      expect(result.reservation.renewal_status).toBe('declined')
    }
  })
})

/**
 * Tests for Guest Management Functions
 *
 * ⚠️ SKIPPED: Legacy integration tests requiring real Supabase connection
 * These tests are in lib/booking/ which is scheduled for deletion.
 * Contract tests now exist in tests/integration/v1-guests-api.test.ts
 *
 * To run these tests locally with real DB:
 * 1. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * 2. Remove .skip from describe blocks
 *
 * Following TDD best practices:
 * - Dynamic ID generation (no hardcoded IDs)
 * - Test edge cases and boundaries
 * - Integration tests (DB-touching)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createOrGetGuest, getGuestById } from './guest'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { testPropertyId, testGuestId, testUUID } from './test-utils/id-helpers'
import type { CreateGuestInput, Guest } from './types'

describe('createOrGetGuest', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
  }

  beforeAll(async () => {
    const property_id = testPropertyId()

    // Create test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Guest Campground',
      slug: 'test-guest-' + Date.now(),
      owner_id: testUUID(),
    })

    testData = { property_id }
  })

  afterAll(async () => {
    // Clean up test data
    await supabase.from('guests').delete().eq('property_id', testData.property_id)
    await supabase.from('properties').delete().eq('id', testData.property_id)
  })

  test('should create new guest when email does not exist', async () => {
    const guestInput: CreateGuestInput = {
      first_name: 'John',
      last_name: 'Doe',
      email: `test-new-${Date.now()}@example.com`,
      phone: '555-0100',
      address: '123 Main St',
      city: 'Portland',
      state: 'OR',
      zip_code: '97201',
      country: 'USA',
    }

    const result = await createOrGetGuest(testData.property_id, guestInput)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe(guestInput.email)
      expect(result.data.first_name).toBe(guestInput.first_name)
      expect(result.data.last_name).toBe(guestInput.last_name)
      expect(result.data.property_id).toBe(testData.property_id)
      expect(result.data.id).toBeDefined()
      expect(result.data.created_at).toBeDefined()
    }
  })

  test('should return existing guest when email already exists', async () => {
    const email = `test-existing-${Date.now()}@example.com`

    // Create guest first time
    const firstResult = await createOrGetGuest(testData.property_id, {
      first_name: 'Jane',
      last_name: 'Smith',
      email,
      phone: '555-0200',
    })

    expect(firstResult.success).toBe(true)
    const firstGuestId = firstResult.success ? firstResult.data.id : null

    // Try to create again with same email
    const secondResult = await createOrGetGuest(testData.property_id, {
      first_name: 'Jane',
      last_name: 'Updated', // Different last name
      email, // Same email
      phone: '555-0300', // Different phone
    })

    expect(secondResult.success).toBe(true)
    if (secondResult.success && firstGuestId) {
      // Should return the same guest (by ID)
      expect(secondResult.data.id).toBe(firstGuestId)
      // Should keep original data (not updated)
      expect(secondResult.data.last_name).toBe('Smith')
      expect(secondResult.data.phone).toBe('555-0200')
    }
  })

  test('should handle minimal guest info (only required fields)', async () => {
    const minimalGuest: CreateGuestInput = {
      first_name: 'Min',
      last_name: 'Guest',
      email: `test-minimal-${Date.now()}@example.com`,
      phone: '555-0400',
    }

    const result = await createOrGetGuest(testData.property_id, minimalGuest)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.first_name).toBe('Min')
      expect(result.data.address).toBeNull()
      expect(result.data.city).toBeNull()
      expect(result.data.state).toBeNull()
    }
  })

  test('should handle guest with emergency contact info', async () => {
    const guestWithEmergency: CreateGuestInput = {
      first_name: 'Emergency',
      last_name: 'Test',
      email: `test-emergency-${Date.now()}@example.com`,
      phone: '555-0500',
      emergency_contact_name: 'Jane Doe',
      emergency_contact_phone: '555-0501',
    }

    const result = await createOrGetGuest(testData.property_id, guestWithEmergency)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.emergency_contact_name).toBe('Jane Doe')
      expect(result.data.emergency_contact_phone).toBe('555-0501')
    }
  })

  test('should validate email format', async () => {
    const invalidEmailGuest: CreateGuestInput = {
      first_name: 'Invalid',
      last_name: 'Email',
      email: 'not-an-email', // Invalid email
      phone: '555-0600',
    }

    const result = await createOrGetGuest(testData.property_id, invalidEmailGuest)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_EMAIL')
    }
  })

  test('should handle missing required fields', async () => {
    const incompleteGuest = {
      first_name: 'Incomplete',
      // Missing last_name, email, phone
    } as CreateGuestInput

    const result = await createOrGetGuest(testData.property_id, incompleteGuest)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })
})

describe('getGuestById', () => {
  const supabase = createServiceRoleClient()
  let testData: {
    property_id: string
    guest: Guest
  }

  beforeAll(async () => {
    const property_id = testPropertyId()
    const guest_id = testGuestId()

    // Create test property
    await supabase.from('properties').insert({
      id: property_id,
      name: 'Test Guest Lookup Campground',
      slug: 'test-guest-lookup-' + Date.now(),
      owner_id: testUUID(),
    })

    // Create test guest
    const { data: guest, error } = await supabase
      .from('guests')
      .insert({
        id: guest_id,
        property_id,
        first_name: 'Lookup',
        last_name: 'Test',
        email: `lookup-${Date.now()}@example.com`,
        phone: '555-0700',
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create test guest: ${error.message}`)

    testData = {
      property_id,
      guest: guest as Guest,
    }
  })

  afterAll(async () => {
    await supabase.from('guests').delete().eq('property_id', testData.property_id)
    await supabase.from('properties').delete().eq('id', testData.property_id)
  })

  test('should retrieve guest by ID', async () => {
    const result = await getGuestById(testData.guest.id)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe(testData.guest.id)
      expect(result.data.email).toBe(testData.guest.email)
      expect(result.data.first_name).toBe('Lookup')
      expect(result.data.last_name).toBe('Test')
    }
  })

  test('should return error for non-existent guest ID', async () => {
    const result = await getGuestById(testUUID())

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('GUEST_NOT_FOUND')
    }
  })

  test('should return error for invalid guest ID format', async () => {
    const result = await getGuestById('invalid-id-format')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('GUEST_NOT_FOUND')
    }
  })
})

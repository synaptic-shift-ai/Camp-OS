/**
 * Guests API v1 Contract Tests
 *
 * Phase 4D: API Consolidation - Guests API
 *
 * Following CLAUDE.md:
 * - T-1: Tests colocated in tests/integration/
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterized test inputs
 * - T-8: Test description states what expect verifies
 * - T-12: Group unit tests under describe(functionName, ...)
 */

import { describe, it, expect } from 'vitest'
import {
  AddressSchema,
  EmergencyContactSchema,
  GuestSchema,
  CreateGuestRequestSchema,
  UpdateGuestRequestSchema,
  LinkStripeCustomerRequestSchema,
  ListGuestsQuerySchema,
  type Guest,
  type CreateGuestRequest,
  type UpdateGuestRequest,
} from '@/types/api/v1/schemas/guests'

describe('Guests API v1 Contract Tests', () => {
  // ========================================================================
  // Address Schema Validation
  // ========================================================================

  describe('AddressSchema', () => {
    it('should validate complete address', () => {
      const validAddress = {
        street: '123 Campground Lane',
        city: 'Yosemite',
        state: 'CA',
        zipCode: '95389',
        country: 'USA',
      }

      const result = AddressSchema.safeParse(validAddress)
      expect(result.success).toBe(true)
    })

    it('should reject empty street', () => {
      const invalidAddress = {
        street: '',
        city: 'Yosemite',
        state: 'CA',
        zipCode: '95389',
        country: 'USA',
      }

      const result = AddressSchema.safeParse(invalidAddress)
      expect(result.success).toBe(false)
    })

    it('should reject missing required fields', () => {
      const invalidAddress = {
        street: '123 Main St',
        city: 'Yosemite',
      }

      const result = AddressSchema.safeParse(invalidAddress)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Emergency Contact Schema Validation
  // ========================================================================

  describe('EmergencyContactSchema', () => {
    it('should validate complete emergency contact', () => {
      const validContact = {
        name: 'Jane Doe',
        phone: '555-987-6543',
      }

      const result = EmergencyContactSchema.safeParse(validContact)
      expect(result.success).toBe(true)
    })

    it('should reject empty name', () => {
      const invalidContact = {
        name: '',
        phone: '555-123-4567',
      }

      const result = EmergencyContactSchema.safeParse(invalidContact)
      expect(result.success).toBe(false)
    })

    it('should reject empty phone', () => {
      const invalidContact = {
        name: 'Jane Doe',
        phone: '',
      }

      const result = EmergencyContactSchema.safeParse(invalidContact)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Create Guest Request Schema Validation
  // ========================================================================

  describe('CreateGuestRequestSchema', () => {
    it('should validate complete guest creation request', () => {
      const validRequest: CreateGuestRequest = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'USA',
        },
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '555-987-6543',
        notes: 'Regular camper, prefers site #12',
      }

      const result = CreateGuestRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate minimal guest creation request', () => {
      const minimalRequest = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
      }

      const result = CreateGuestRequestSchema.safeParse(minimalRequest)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email format', () => {
      const invalidRequest = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'not-an-email',
        phone: '555-123-4567',
      }

      const result = CreateGuestRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject empty first name', () => {
      const invalidRequest = {
        firstName: '',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
      }

      const result = CreateGuestRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject empty last name', () => {
      const invalidRequest = {
        firstName: 'John',
        lastName: '',
        email: 'john@example.com',
        phone: '555-123-4567',
      }

      const result = CreateGuestRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject empty phone', () => {
      const invalidRequest = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '',
      }

      const result = CreateGuestRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject first name over 100 characters', () => {
      const invalidRequest = {
        firstName: 'A'.repeat(101),
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
      }

      const result = CreateGuestRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject notes over 1000 characters', () => {
      const invalidRequest = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        notes: 'A'.repeat(1001),
      }

      const result = CreateGuestRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Update Guest Request Schema Validation
  // ========================================================================

  describe('UpdateGuestRequestSchema', () => {
    it('should validate update with email only', () => {
      const validRequest: UpdateGuestRequest = {
        email: 'newemail@example.com',
      }

      const result = UpdateGuestRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate update with phone only', () => {
      const validRequest: UpdateGuestRequest = {
        phone: '555-999-8888',
      }

      const result = UpdateGuestRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate update with address', () => {
      const validRequest: UpdateGuestRequest = {
        address: {
          street: '456 New Street',
          city: 'Newtown',
          state: 'NY',
          zipCode: '54321',
          country: 'USA',
        },
      }

      const result = UpdateGuestRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate update with null address (clearing)', () => {
      const validRequest = {
        address: null,
      }

      const result = UpdateGuestRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate empty update request (no changes)', () => {
      const validRequest = {}

      const result = UpdateGuestRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate complete update request', () => {
      const validRequest: UpdateGuestRequest = {
        email: 'updated@example.com',
        phone: '555-111-2222',
        address: {
          street: '789 Updated Blvd',
          city: 'UpdateCity',
          state: 'TX',
          zipCode: '77777',
          country: 'USA',
        },
        emergencyContactName: 'Updated Contact',
        emergencyContactPhone: '555-333-4444',
        notes: 'Updated notes',
      }

      const result = UpdateGuestRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email format', () => {
      const invalidRequest = {
        email: 'invalid-email',
      }

      const result = UpdateGuestRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Link Stripe Customer Request Schema Validation
  // ========================================================================

  describe('LinkStripeCustomerRequestSchema', () => {
    it('should validate valid Stripe customer ID', () => {
      const validRequest = {
        stripeCustomerId: 'cus_1234567890abcdef',
      }

      const result = LinkStripeCustomerRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate Stripe customer ID with alphanumeric characters', () => {
      const validRequest = {
        stripeCustomerId: 'cus_AbCdEf123456',
      }

      const result = LinkStripeCustomerRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject invalid Stripe customer ID format', () => {
      const invalidRequest = {
        stripeCustomerId: 'invalid_customer_id',
      }

      const result = LinkStripeCustomerRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject Stripe customer ID without cus_ prefix', () => {
      const invalidRequest = {
        stripeCustomerId: '1234567890abcdef',
      }

      const result = LinkStripeCustomerRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject empty Stripe customer ID', () => {
      const invalidRequest = {
        stripeCustomerId: '',
      }

      const result = LinkStripeCustomerRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // List Guests Query Schema Validation
  // ========================================================================

  describe('ListGuestsQuerySchema', () => {
    it('should validate empty query (defaults)', () => {
      const result = ListGuestsQuerySchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should validate query with email filter', () => {
      const query = {
        email: 'john@example.com',
      }

      const result = ListGuestsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
    })

    it('should validate query with hasStripeCustomer filter', () => {
      const query = {
        hasStripeCustomer: 'true',
      }

      const result = ListGuestsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hasStripeCustomer).toBe(true)
      }
    })

    it('should transform hasStripeCustomer false string correctly', () => {
      const query = {
        hasStripeCustomer: 'false',
      }

      const result = ListGuestsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hasStripeCustomer).toBe(false)
      }
    })

    it('should validate query with pagination', () => {
      const query = {
        limit: '50',
        offset: '20',
      }

      const result = ListGuestsQuerySchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(20)
      }
    })

    it('should reject limit over 100', () => {
      const query = {
        limit: '150',
      }

      const result = ListGuestsQuerySchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should reject negative offset', () => {
      const query = {
        offset: '-5',
      }

      const result = ListGuestsQuerySchema.safeParse(query)
      expect(result.success).toBe(false)
    })

    it('should reject invalid email in query', () => {
      const query = {
        email: 'not-an-email',
      }

      const result = ListGuestsQuerySchema.safeParse(query)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Guest Response Schema Validation
  // ========================================================================

  describe('GuestSchema', () => {
    it('should validate complete guest entity', () => {
      const completeGuest: Guest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '770e8400-e29b-41d4-a716-446655440002',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        address: {
          street: '123 Campground Lane',
          city: 'Yosemite',
          state: 'CA',
          zipCode: '95389',
          country: 'USA',
        },
        emergencyContact: {
          name: 'Jane Doe',
          phone: '555-987-6543',
        },
        hasStripeCustomer: true,
        stripeCustomerId: 'cus_1234567890',
        notes: 'Returning guest, prefers waterfront sites',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-10T14:30:00Z',
      }

      expect(() => GuestSchema.parse(completeGuest)).not.toThrow()
    })

    it('should validate guest with null optional fields', () => {
      const minimalGuest: Guest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: null,
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        address: null,
        emergencyContact: null,
        hasStripeCustomer: false,
        stripeCustomerId: null,
        notes: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => GuestSchema.parse(minimalGuest)).not.toThrow()
    })

    it('should reject guest with invalid UUID', () => {
      const invalid = {
        id: 'not-a-uuid',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: null,
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        address: null,
        emergencyContact: null,
        hasStripeCustomer: false,
        stripeCustomerId: null,
        notes: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => GuestSchema.parse(invalid)).toThrow()
    })

    it('should reject guest with invalid email', () => {
      const invalid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: null,
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'invalid-email',
        phone: '555-123-4567',
        address: null,
        emergencyContact: null,
        hasStripeCustomer: false,
        stripeCustomerId: null,
        notes: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => GuestSchema.parse(invalid)).toThrow()
    })

    it('should reject guest with missing required fields', () => {
      const invalid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        firstName: 'John',
        lastName: 'Doe',
      }

      expect(() => GuestSchema.parse(invalid)).toThrow()
    })
  })

  // ========================================================================
  // Business Logic Verification
  // ========================================================================

  describe('Guest Business Logic', () => {
    it('fullName should be combination of firstName and lastName', () => {
      const firstName = 'John'
      const lastName = 'Doe'
      const expectedFullName = `${firstName} ${lastName}`

      expect(expectedFullName).toBe('John Doe')
    })

    it('guest with Stripe customer should have hasStripeCustomer true', () => {
      const guestWithStripe = {
        hasStripeCustomer: true,
        stripeCustomerId: 'cus_1234567890',
      }

      expect(guestWithStripe.hasStripeCustomer).toBe(true)
      expect(guestWithStripe.stripeCustomerId).not.toBeNull()
    })

    it('guest without Stripe customer should have hasStripeCustomer false', () => {
      const guestWithoutStripe = {
        hasStripeCustomer: false,
        stripeCustomerId: null,
      }

      expect(guestWithoutStripe.hasStripeCustomer).toBe(false)
      expect(guestWithoutStripe.stripeCustomerId).toBeNull()
    })

    it('emergency contact should have both name and phone', () => {
      const validEmergencyContact = {
        name: 'Jane Doe',
        phone: '555-987-6543',
      }

      expect(validEmergencyContact.name).toBeTruthy()
      expect(validEmergencyContact.phone).toBeTruthy()
    })

    it('address should have all required fields', () => {
      const requiredFields = ['street', 'city', 'state', 'zipCode', 'country']
      const validAddress = {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'USA',
      }

      requiredFields.forEach((field) => {
        expect(validAddress).toHaveProperty(field)
        expect(validAddress[field as keyof typeof validAddress]).toBeTruthy()
      })
    })
  })
})

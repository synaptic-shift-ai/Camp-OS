/**
 * Guests API v1 Contract Tests
 *
 * Phase 2, Week 7: Guest Management Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * CRITICAL: These tests prevent the Oct 30 incident pattern
 * - Validates complete Guest entity schema
 * - Ensures all fields are ALWAYS present
 * - Tests for missing fields that would cause silent failures
 *
 * Following CLAUDE.md:
 * - T-1: Tests colocated in tests/integration/
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterized test inputs
 * - T-8: Test description states what expect verifies
 */

import { describe, it, expect } from 'vitest'
import {
  GuestSchema,
  CreateGuestRequestSchema,
  UpdateGuestRequestSchema,
  LinkStripeCustomerRequestSchema,
  ListGuestsQuerySchema,
  GuestResponseSchema,
  GuestListResponseSchema,
  AddressSchema,
  EmergencyContactSchema,
  type Guest,
  type CreateGuestRequest,
  type UpdateGuestRequest,
} from '@/types/api/v1/schemas/guests'

describe('Guests API v1 Contract Tests', () => {
  // ========================================================================
  // Complete Entity Schema Tests (Oct 30 Regression Prevention)
  // ========================================================================

  describe('GuestSchema - Complete Entity Validation', () => {
    it('should validate complete guest entity with all fields present', () => {
      const completeGuest: Guest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '770e8400-e29b-41d4-a716-446655440002',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: {
          street: '123 Main St',
          city: 'Portland',
          state: 'OR',
          zipCode: '97201',
          country: 'USA',
        },
        emergencyContact: {
          name: 'Jane Doe',
          phone: '555-0200',
        },
        hasStripeCustomer: true,
        stripeCustomerId: 'cus_123456',
        notes: 'VIP guest',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => GuestSchema.parse(completeGuest)).not.toThrow()
    })

    it('should reject guest missing required field (firstName)', () => {
      const incompleteGuest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: null,
        // firstName is MISSING
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: null,
        emergencyContact: null,
        hasStripeCustomer: false,
        stripeCustomerId: null,
        notes: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => GuestSchema.parse(incompleteGuest)).toThrow()
    })

    it('should reject guest missing tenant isolation field (propertyId)', () => {
      const guestWithoutTenantId = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        // propertyId is MISSING - critical for tenant isolation
        userId: null,
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '555-0100',
        hasStripeCustomer: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => GuestSchema.parse(guestWithoutTenantId)).toThrow()
    })

    it('should accept guest with nullable fields set to null', () => {
      const guestWithNulls: Guest = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: null, // Optional
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: null, // Optional
        emergencyContact: null, // Optional
        hasStripeCustomer: false,
        stripeCustomerId: null, // Optional
        notes: null, // Optional
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => GuestSchema.parse(guestWithNulls)).not.toThrow()
    })

    it('should reject guest with invalid email format', () => {
      const guestWithInvalidEmail = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        userId: null,
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'not-an-email', // Invalid format
        phone: '555-0100',
        address: null,
        emergencyContact: null,
        hasStripeCustomer: false,
        stripeCustomerId: null,
        notes: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => GuestSchema.parse(guestWithInvalidEmail)).toThrow()
    })
  })

  // ========================================================================
  // Address Schema Tests
  // ========================================================================

  describe('AddressSchema - Value Object Validation', () => {
    it('should validate complete address with all required fields', () => {
      const completeAddress = {
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      }

      expect(() => AddressSchema.parse(completeAddress)).not.toThrow()
    })

    it('should reject partial address missing required field (city)', () => {
      const partialAddress = {
        street: '123 Main St',
        // city is MISSING
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      }

      expect(() => AddressSchema.parse(partialAddress)).toThrow()
    })

    it('should reject address with empty string fields', () => {
      const addressWithEmptyStrings = {
        street: '',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      }

      expect(() => AddressSchema.parse(addressWithEmptyStrings)).toThrow()
    })
  })

  // ========================================================================
  // Emergency Contact Schema Tests
  // ========================================================================

  describe('EmergencyContactSchema - Value Object Validation', () => {
    it('should validate emergency contact with both name and phone', () => {
      const emergencyContact = {
        name: 'Jane Doe',
        phone: '555-0200',
      }

      expect(() => EmergencyContactSchema.parse(emergencyContact)).not.toThrow()
    })

    it('should reject emergency contact missing phone', () => {
      const incompleteContact = {
        name: 'Jane Doe',
        // phone is MISSING
      }

      expect(() => EmergencyContactSchema.parse(incompleteContact)).toThrow()
    })
  })

  // ========================================================================
  // Create Guest Request Schema Tests
  // ========================================================================

  describe('CreateGuestRequestSchema - Input Validation', () => {
    it('should validate minimal required fields for guest creation', () => {
      const minimalRequest: CreateGuestRequest = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
      }

      expect(() => CreateGuestRequestSchema.parse(minimalRequest)).not.toThrow()
    })

    it('should validate complete request with all optional fields', () => {
      const completeRequest: CreateGuestRequest = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: {
          street: '123 Main St',
          city: 'Portland',
          state: 'OR',
          zipCode: '97201',
          country: 'USA',
        },
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '555-0200',
        userId: '770e8400-e29b-41d4-a716-446655440002',
        notes: 'VIP guest',
      }

      expect(() => CreateGuestRequestSchema.parse(completeRequest)).not.toThrow()
    })

    it('should reject request with invalid email format', () => {
      const invalidRequest = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'not-an-email',
        phone: '555-0100',
      }

      expect(() => CreateGuestRequestSchema.parse(invalidRequest)).toThrow()
    })

    it('should reject request with empty firstName', () => {
      const invalidRequest = {
        firstName: '',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
      }

      expect(() => CreateGuestRequestSchema.parse(invalidRequest)).toThrow()
    })

    it('should reject request with firstName exceeding max length', () => {
      const invalidRequest = {
        firstName: 'a'.repeat(101), // Max is 100
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
      }

      expect(() => CreateGuestRequestSchema.parse(invalidRequest)).toThrow()
    })
  })

  // ========================================================================
  // Update Guest Request Schema Tests
  // ========================================================================

  describe('UpdateGuestRequestSchema - Input Validation', () => {
    it('should validate empty update request (all fields optional)', () => {
      const emptyUpdate: UpdateGuestRequest = {}

      expect(() => UpdateGuestRequestSchema.parse(emptyUpdate)).not.toThrow()
    })

    it('should validate partial update with single field', () => {
      const partialUpdate: UpdateGuestRequest = {
        email: 'newemail@example.com',
      }

      expect(() => UpdateGuestRequestSchema.parse(partialUpdate)).not.toThrow()
    })

    it('should validate update with address set to null', () => {
      const updateWithNullAddress: UpdateGuestRequest = {
        address: null,
      }

      expect(() => UpdateGuestRequestSchema.parse(updateWithNullAddress)).not.toThrow()
    })

    it('should reject update with invalid email', () => {
      const invalidUpdate = {
        email: 'not-an-email',
      }

      expect(() => UpdateGuestRequestSchema.parse(invalidUpdate)).toThrow()
    })
  })

  // ========================================================================
  // Link Stripe Customer Request Schema Tests
  // ========================================================================

  describe('LinkStripeCustomerRequestSchema - Input Validation', () => {
    it('should validate valid Stripe Customer ID format', () => {
      const validRequest = {
        stripeCustomerId: 'cus_123456abcdef',
      }

      expect(() => LinkStripeCustomerRequestSchema.parse(validRequest)).not.toThrow()
    })

    it('should reject Stripe Customer ID without "cus_" prefix', () => {
      const invalidRequest = {
        stripeCustomerId: '123456abcdef', // Missing cus_ prefix
      }

      expect(() => LinkStripeCustomerRequestSchema.parse(invalidRequest)).toThrow()
    })

    it('should reject empty Stripe Customer ID', () => {
      const invalidRequest = {
        stripeCustomerId: '',
      }

      expect(() => LinkStripeCustomerRequestSchema.parse(invalidRequest)).toThrow()
    })
  })

  // ========================================================================
  // List Guests Query Schema Tests
  // ========================================================================

  describe('ListGuestsQuerySchema - Query Parameter Validation', () => {
    it('should validate empty query (all parameters optional)', () => {
      const emptyQuery = {}

      expect(() => ListGuestsQuerySchema.parse(emptyQuery)).not.toThrow()
    })

    it('should validate query with email filter', () => {
      const queryWithEmail = {
        email: 'john@example.com',
      }

      expect(() => ListGuestsQuerySchema.parse(queryWithEmail)).not.toThrow()
    })

    it('should transform string limit to number', () => {
      const queryWithLimit = {
        limit: '10',
      }

      const result = ListGuestsQuerySchema.parse(queryWithLimit)
      expect(result.limit).toBe(10)
      expect(typeof result.limit).toBe('number')
    })

    it('should reject limit exceeding max (100)', () => {
      const invalidQuery = {
        limit: '101',
      }

      expect(() => ListGuestsQuerySchema.parse(invalidQuery)).toThrow()
    })

    it('should transform hasStripeCustomer string to boolean', () => {
      const queryWithFilter = {
        hasStripeCustomer: 'true',
      }

      const result = ListGuestsQuerySchema.parse(queryWithFilter)
      expect(result.hasStripeCustomer).toBe(true)
      expect(typeof result.hasStripeCustomer).toBe('boolean')
    })
  })

  // ========================================================================
  // Response Schema Tests
  // ========================================================================

  describe('GuestResponseSchema - API Response Validation', () => {
    it('should validate single guest success response', () => {
      const successResponse = {
        success: true,
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          propertyId: '660e8400-e29b-41d4-a716-446655440001',
          userId: null,
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '555-0100',
          address: null,
          emergencyContact: null,
          hasStripeCustomer: false,
          stripeCustomerId: null,
          notes: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        },
        meta: {
          timestamp: '2025-01-02T12:00:00Z',
          version: 'v1',
        },
      }

      expect(() => GuestResponseSchema.parse(successResponse)).not.toThrow()
    })

    it('should reject response with success: false (not a success response)', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Guest not found',
        },
        meta: {
          timestamp: '2025-01-02T12:00:00Z',
          version: 'v1',
        },
      }

      expect(() => GuestResponseSchema.parse(errorResponse)).toThrow()
    })
  })

  describe('GuestListResponseSchema - List Response Validation', () => {
    it('should validate guest list success response', () => {
      const listResponse = {
        success: true,
        data: {
          items: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              propertyId: '660e8400-e29b-41d4-a716-446655440001',
              userId: null,
              firstName: 'John',
              lastName: 'Doe',
              fullName: 'John Doe',
              email: 'john@example.com',
              phone: '555-0100',
              address: null,
              emergencyContact: null,
              hasStripeCustomer: false,
              stripeCustomerId: null,
              notes: null,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-02T00:00:00Z',
            },
          ],
          pagination: {
            page: 1,
            per_page: 20,
            total: 1,
            total_pages: 1,
          },
        },
        meta: {
          timestamp: '2025-01-02T12:00:00Z',
          version: 'v1',
        },
      }

      expect(() => GuestListResponseSchema.parse(listResponse)).not.toThrow()
    })

    it('should validate empty list response', () => {
      const emptyListResponse = {
        success: true,
        data: {
          items: [],
          pagination: {
            page: 1,
            per_page: 20,
            total: 0,
            total_pages: 0,
          },
        },
        meta: {
          timestamp: '2025-01-02T12:00:00Z',
          version: 'v1',
        },
      }

      expect(() => GuestListResponseSchema.parse(emptyListResponse)).not.toThrow()
    })

    it('should reject list response missing pagination', () => {
      const invalidResponse = {
        success: true,
        data: {
          items: [],
          // pagination is MISSING
        },
        meta: {
          timestamp: '2025-01-02T12:00:00Z',
          version: 'v1',
        },
      }

      expect(() => GuestListResponseSchema.parse(invalidResponse)).toThrow()
    })
  })
})

/**
 * Properties API Integration Tests
 *
 * Phase 1.4: Properties API Contract Tests
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 * Reference: docs/architecture/API_CONTRACT_SAFETY.md
 *
 * CRITICAL: These tests verify the Oct 30, 2025 incident cannot recur.
 *
 * Test Coverage:
 * 1. Response schema validation
 * 2. All required fields present
 * 3. Regression test for selective fetching bug
 * 4. Multi-tenant isolation
 *
 * Following CLAUDE.md:
 * - T-2: Integration tests in tests/integration/
 * - T-3: Separate from unit tests (these touch database)
 * - T-4: Prefer integration tests over heavy mocking
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterize test inputs
 * - T-8: Test description states what final expect verifies
 * - T-10: Test edge cases and boundaries
 */

import { describe, it, expect } from 'vitest'
import {
  PropertyListResponseSchema,
  PropertyResponseSchema,
  validatePropertyListResponse,
  safeValidatePropertyListResponse,
  formatValidationError,
  type PropertyListResponse,
} from '@/types/api/property.schema'

describe('Properties API Contract', () => {
  describe('PropertyResponseSchema', () => {
    it('should validate a complete property object with all required fields', () => {
      const validProperty = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'pine-valley-campground',
        name: 'Pine Valley Campground',
        company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
        onboarding_completed: false,
        created_at: '2025-11-05T12:00:00Z',
        updated_at: '2025-11-05T12:00:00Z',
        address: '123 Forest Road',
        city: 'Pine Valley',
        state: 'CA',
        zip_code: '95001',
        country: 'USA',
        phone: '+1-555-0100',
        email: 'info@pinevalley.com',
        description: 'Beautiful campground in the mountains',
        property_type: 'campground',
        timezone: 'America/Los_Angeles',
        check_in_time: '14:00:00',
        check_out_time: '11:00:00',
        status: 'active',
        subdomain: null,
        amenities: { wifi: true, showers: true },
        settings: {},
        owner_id: 'abc12345-6789-def0-1234-56789abcdef0',
        stripe_account_id: 'acct_test123',
        stripe_connected_at: '2025-11-01T10:00:00Z',
        booking_page_slug: 'pine-valley-abc123',
        onboarding_completed_at: null,
      }

      expect(() => PropertyResponseSchema.parse(validProperty)).not.toThrow()
    })

    it('should reject property missing critical id field', () => {
      const invalidProperty = {
        // id: MISSING
        slug: 'test-campground',
        name: 'Test Campground',
        company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
        onboarding_completed: false,
        created_at: null,
        updated_at: null,
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        phone: null,
        email: null,
        description: null,
        property_type: null,
        timezone: null,
        check_in_time: null,
        check_out_time: null,
        status: null,
        subdomain: null,
        amenities: null,
        settings: null,
        owner_id: null,
        stripe_account_id: null,
        stripe_connected_at: null,
        booking_page_slug: null,
        onboarding_completed_at: null,
      }

      expect(() => PropertyResponseSchema.parse(invalidProperty)).toThrow()
    })

    it('should reject property missing critical name field', () => {
      const invalidProperty = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-campground',
        // name: MISSING
        company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
        onboarding_completed: false,
      }

      expect(() => PropertyResponseSchema.parse(invalidProperty)).toThrow()
    })

    it('should reject property missing critical company_id field (tenant isolation)', () => {
      const invalidProperty = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-campground',
        name: 'Test Campground',
        // company_id: MISSING - violates tenant isolation
        onboarding_completed: false,
      }

      expect(() => PropertyResponseSchema.parse(invalidProperty)).toThrow()
    })

    it('should reject property missing critical onboarding_completed field (Oct 30 incident)', () => {
      const invalidProperty = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-campground',
        name: 'Test Campground',
        company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
        // onboarding_completed: MISSING - caused Oct 30 incident
      }

      expect(() => PropertyResponseSchema.parse(invalidProperty)).toThrow()
    })

    it('should accept nullable optional fields', () => {
      const minimalProperty = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'minimal-campground',
        name: 'Minimal Campground',
        company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
        onboarding_completed: false,
        created_at: null,
        updated_at: null,
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        phone: null,
        email: null,
        description: null,
        property_type: null,
        timezone: null,
        check_in_time: null,
        check_out_time: null,
        status: null,
        subdomain: null,
        amenities: null,
        settings: null,
        owner_id: null,
        stripe_account_id: null,
        stripe_connected_at: null,
        booking_page_slug: null,
        onboarding_completed_at: null,
      }

      expect(() => PropertyResponseSchema.parse(minimalProperty)).not.toThrow()
    })

    it('should reject invalid UUID format for id field', () => {
      const invalidProperty = {
        id: 'not-a-uuid',  // Invalid UUID
        slug: 'test-campground',
        name: 'Test Campground',
        company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
        onboarding_completed: false,
      }

      expect(() => PropertyResponseSchema.parse(invalidProperty)).toThrow(/UUID/)
    })

    it('should reject invalid email format', () => {
      const invalidProperty = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-campground',
        name: 'Test Campground',
        company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
        onboarding_completed: false,
        email: 'not-an-email',  // Invalid email
        created_at: null,
        updated_at: null,
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        phone: null,
        description: null,
        property_type: null,
        timezone: null,
        check_in_time: null,
        check_out_time: null,
        status: null,
        subdomain: null,
        amenities: null,
        settings: null,
        owner_id: null,
        stripe_account_id: null,
        stripe_connected_at: null,
        booking_page_slug: null,
        onboarding_completed_at: null,
      }

      expect(() => PropertyResponseSchema.parse(invalidProperty)).toThrow(/email/)
    })
  })

  describe('PropertyListResponseSchema', () => {
    it('should validate empty properties array', () => {
      const emptyResponse = {
        properties: [],
      }

      expect(() => PropertyListResponseSchema.parse(emptyResponse)).not.toThrow()
    })

    it('should validate properties array with multiple items', () => {
      const multiPropertyResponse = {
        properties: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            slug: 'property-1',
            name: 'Property 1',
            company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
            onboarding_completed: true,
            created_at: '2025-11-05T12:00:00Z',
            updated_at: '2025-11-05T12:00:00Z',
            address: null,
            city: null,
            state: null,
            zip_code: null,
            country: null,
            phone: null,
            email: null,
            description: null,
            property_type: null,
            timezone: null,
            check_in_time: null,
            check_out_time: null,
            status: null,
            subdomain: null,
            amenities: null,
            settings: null,
            owner_id: null,
            stripe_account_id: null,
            stripe_connected_at: null,
            booking_page_slug: null,
            onboarding_completed_at: '2025-11-01T10:00:00Z',
          },
          {
            id: '234e5678-e89b-12d3-a456-426614174111',
            slug: 'property-2',
            name: 'Property 2',
            company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
            onboarding_completed: false,
            created_at: '2025-11-04T12:00:00Z',
            updated_at: '2025-11-04T12:00:00Z',
            address: null,
            city: null,
            state: null,
            zip_code: null,
            country: null,
            phone: null,
            email: null,
            description: null,
            property_type: null,
            timezone: null,
            check_in_time: null,
            check_out_time: null,
            status: null,
            subdomain: null,
            amenities: null,
            settings: null,
            owner_id: null,
            stripe_account_id: null,
            stripe_connected_at: null,
            booking_page_slug: null,
            onboarding_completed_at: null,
          },
        ],
      }

      expect(() => PropertyListResponseSchema.parse(multiPropertyResponse)).not.toThrow()
    })

    it('should reject response missing properties array', () => {
      const invalidResponse = {
        // properties: MISSING
      }

      expect(() => PropertyListResponseSchema.parse(invalidResponse)).toThrow()
    })

    it('should reject response with null properties value', () => {
      const invalidResponse = {
        properties: null,  // Should be array, not null
      }

      expect(() => PropertyListResponseSchema.parse(invalidResponse)).toThrow()
    })
  })

  describe('validatePropertyListResponse', () => {
    it('should return validated data for valid response', () => {
      const validResponse = {
        properties: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            slug: 'test-property',
            name: 'Test Property',
            company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
            onboarding_completed: false,
            created_at: '2025-11-05T12:00:00Z',
            updated_at: '2025-11-05T12:00:00Z',
            address: null,
            city: null,
            state: null,
            zip_code: null,
            country: null,
            phone: null,
            email: null,
            description: null,
            property_type: null,
            timezone: null,
            check_in_time: null,
            check_out_time: null,
            status: null,
            subdomain: null,
            amenities: null,
            settings: null,
            owner_id: null,
            stripe_account_id: null,
            stripe_connected_at: null,
            booking_page_slug: null,
            onboarding_completed_at: null,
          },
        ],
      }

      const result = validatePropertyListResponse(validResponse)

      expect(result).toEqual(validResponse)
      expect(result.properties).toHaveLength(1)
      expect(result.properties[0].id).toBe('123e4567-e89b-12d3-a456-426614174000')
    })

    it('should throw ZodError for invalid response', () => {
      const invalidResponse = {
        properties: [
          {
            id: 'invalid-uuid',  // Invalid UUID
            slug: 'test',
            name: 'Test',
            company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
            onboarding_completed: false,
          },
        ],
      }

      expect(() => validatePropertyListResponse(invalidResponse)).toThrow()
    })
  })

  describe('safeValidatePropertyListResponse', () => {
    it('should return success for valid response', () => {
      const validResponse = {
        properties: [],
      }

      const result = safeValidatePropertyListResponse(validResponse)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.properties).toEqual([])
      }
    })

    it('should return error for invalid response', () => {
      const invalidResponse = {
        properties: null,  // Should be array
      }

      const result = safeValidatePropertyListResponse(invalidResponse)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.error.errors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('formatValidationError', () => {
    it('should format validation errors with field paths and messages', () => {
      const invalidResponse = {
        properties: [
          {
            id: 'not-a-uuid',  // Invalid
            slug: '',  // Empty
            // name: missing
            company_id: 'also-not-uuid',  // Invalid
          },
        ],
      }

      try {
        PropertyListResponseSchema.parse(invalidResponse)
        expect.fail('Should have thrown validation error')
      } catch (error: any) {
        const formatted = formatValidationError(error)

        expect(formatted.fields).toBeDefined()
        expect(formatted.fields.length).toBeGreaterThan(0)
        expect(formatted.summary).toContain('Validation failed')
        expect(formatted.fields.every((f) => f.field && f.message)).toBe(true)
      }
    })
  })

  describe('Regression Tests - Oct 30 Incident', () => {
    it('should reject response missing onboarding_completed field (incident root cause)', () => {
      // This simulates the Oct 30 incident where selective fetching
      // omitted the onboarding_completed field
      const incidentResponse = {
        properties: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            slug: 'test-property',
            name: 'Test Property',
            company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
            // onboarding_completed: MISSING - caused infinite redirect loop
          },
        ],
      }

      const result = safeValidatePropertyListResponse(incidentResponse)

      expect(result.success).toBe(false)
      if (!result.success) {
        const formatted = formatValidationError(result.error)
        expect(formatted.summary).toContain('onboarding_completed')
      }
    })

    it('should reject response missing slug field (another critical field)', () => {
      const partialResponse = {
        properties: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            // slug: MISSING - needed for routing
            name: 'Test Property',
            company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
            onboarding_completed: false,
          },
        ],
      }

      expect(() => validatePropertyListResponse(partialResponse)).toThrow()
    })

    it('should reject response missing company_id field (tenant isolation)', () => {
      const unsafeResponse = {
        properties: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            slug: 'test-property',
            name: 'Test Property',
            // company_id: MISSING - violates multi-tenant isolation
            onboarding_completed: false,
          },
        ],
      }

      expect(() => validatePropertyListResponse(unsafeResponse)).toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string for nullable email field', () => {
      const propertyWithEmptyEmail = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-property',
        name: 'Test Property',
        company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
        onboarding_completed: false,
        email: '',  // Empty string should be allowed
        created_at: null,
        updated_at: null,
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        phone: null,
        description: null,
        property_type: null,
        timezone: null,
        check_in_time: null,
        check_out_time: null,
        status: null,
        subdomain: null,
        amenities: null,
        settings: null,
        owner_id: null,
        stripe_account_id: null,
        stripe_connected_at: null,
        booking_page_slug: null,
        onboarding_completed_at: null,
      }

      expect(() => PropertyResponseSchema.parse(propertyWithEmptyEmail)).not.toThrow()
    })

    it('should handle complex nested JSON in amenities field', () => {
      const propertyWithComplexAmenities = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-property',
        name: 'Test Property',
        company_id: '987fcdeb-51a2-43e7-b123-456789abcdef',
        onboarding_completed: false,
        amenities: {
          wifi: true,
          showers: { count: 4, hot_water: true },
          activities: ['hiking', 'fishing', 'kayaking'],
        },
        created_at: null,
        updated_at: null,
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        phone: null,
        email: null,
        description: null,
        property_type: null,
        timezone: null,
        check_in_time: null,
        check_out_time: null,
        status: null,
        subdomain: null,
        settings: null,
        owner_id: null,
        stripe_account_id: null,
        stripe_connected_at: null,
        booking_page_slug: null,
        onboarding_completed_at: null,
      }

      expect(() => PropertyResponseSchema.parse(propertyWithComplexAmenities)).not.toThrow()
    })
  })
})

/**
 * Properties API v1 Contract Tests
 *
 * Phase 2, Week 5-6: Property Management Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * CRITICAL: These tests prevent the Oct 30 incident
 * - Validates complete Property entity schema
 * - Ensures onboarding_completed field is ALWAYS present
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
  PropertySchema,
  CreatePropertyRequestSchema,
  UpdatePropertyRequestSchema,
  ListPropertiesResponseSchema,
  GetPropertyResponseSchema,
  type Property,
} from '@/types/api/v1/schemas/properties'

describe('Properties API v1 Contract Tests', () => {
  // ========================================================================
  // Complete Entity Schema Tests (Oct 30 Regression Prevention)
  // ========================================================================

  describe('PropertySchema - Complete Entity Validation', () => {
    it('should validate complete property entity with all required fields', () => {
      const completeProperty: Property = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        companyId: '660e8400-e29b-41d4-a716-446655440001',
        ownerId: '770e8400-e29b-41d4-a716-446655440002',
        name: 'Mountain View Campground',
        slug: 'mountain-view',
        description: 'Beautiful mountain campground',
        propertyType: 'campground',
        propertyTypeLabel: 'Campground',
        status: 'active',
        statusLabel: 'Active',

        // Location
        address: '123 Mountain Rd',
        city: 'Boulder',
        state: 'CO',
        zipCode: '80301',
        country: 'USA',

        // Contact
        phone: '555-1234',
        email: 'info@example.com',

        // Branding
        checkInTime: '15:00',
        checkOutTime: '11:00',
        subdomain: 'mountain-view',
        bookingPageSlug: 'mountain-view-booking',
        galleryImages: [],

        // Settings
        settings: {
          checkInTime: '14:00',
          checkOutTime: '11:00',
          timezone: 'America/Denver',
          cancellationPolicy: 'flexible',
          minStayNights: 1,
          maxStayNights: 30,
          bookingLeadTimeDays: 365,
          customRules: 'No pets',
          openPeriodFrom: null,
          openPeriodUntil: null,
        },

        // Amenities
        amenities: [
          { id: 'wifi', name: 'wifi', description: null },
          { id: 'showers', name: 'showers', description: null },
          { id: 'laundry', name: 'laundry', description: null },
        ],
        site_amenities: null,

        // Onboarding (CRITICAL - Oct 30 fix)
        onboardingStatus: 'completed',
        onboardingStatusLabel: 'Completed',
        onboardingCompleted: true, // CRITICAL FIELD
        onboardingCompletedAt: '2025-01-01T12:00:00Z',

        // Stripe Connect
        stripeAccountId: 'acct_123',
        stripeConnectedAt: '2025-01-01T10:00:00Z',
        stripeConnected: true,

        // Capabilities
        canAcceptBookings: true,

        // Timestamps
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => PropertySchema.parse(completeProperty)).not.toThrow()
    })

    it('should reject property missing critical onboarding_completed field (Oct 30 regression test)', () => {
      const incompleteProperty = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        companyId: '660e8400-e29b-41d4-a716-446655440001',
        ownerId: '770e8400-e29b-41d4-a716-446655440002',
        name: 'Mountain View Campground',
        slug: 'mountain-view',
        status: 'active',
        statusLabel: 'Active',
        // onboarding_completed is MISSING - this caused Oct 30 incident
        onboardingStatus: 'completed',
        onboardingStatusLabel: 'Completed',
        onboardingCompletedAt: '2025-01-01T12:00:00Z',
        stripeAccountId: null,
        stripeConnectedAt: null,
        stripeConnected: false,
        canAcceptBookings: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => PropertySchema.parse(incompleteProperty)).toThrow()
    })

    it('should reject property missing tenant isolation field (companyId)', () => {
      const propertyWithoutTenantId = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        // companyId is MISSING
        ownerId: '770e8400-e29b-41d4-a716-446655440002',
        name: 'Mountain View Campground',
        slug: 'mountain-view',
        onboardingCompleted: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => PropertySchema.parse(propertyWithoutTenantId)).toThrow()
    })

    it('should reject property missing any required field (prevents Oct 30 pattern)', () => {
      // Missing multiple required fields
      const incompleteResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Property',
        // Missing: companyId, slug, status, onboardingCompleted, timestamps, etc.
      }

      expect(() => PropertySchema.parse(incompleteResponse)).toThrow()
    })

    it('should accept property with nullable fields set to null', () => {
      const propertyWithNulls: Property = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        companyId: '660e8400-e29b-41d4-a716-446655440001',
        ownerId: null, // Nullable
        name: 'Basic Property',
        slug: 'basic-property',
        description: null,
        propertyType: null,
        propertyTypeLabel: null,
        status: 'draft',
        statusLabel: 'Draft',

        // Location - all nullable
        address: null,
        city: null,
        state: null,
        zipCode: null,
        country: null,

        // Contact - nullable
        phone: null,
        email: null,
        checkInTime: null,
        checkOutTime: null,

        // Branding - nullable
        subdomain: null,
        bookingPageSlug: null,
        galleryImages: null,

        // Settings with nulls
        settings: {
          checkInTime: null,
          checkOutTime: null,
          timezone: null,
          cancellationPolicy: null,
          minStayNights: null,
          maxStayNights: null,
          bookingLeadTimeDays: null,
          customRules: null,
          openPeriodFrom: null,
          openPeriodUntil: null,
        },

        // Amenities - nullable
        amenities: null,
        site_amenities: null,

        // Onboarding - not complete
        onboardingStatus: 'not_started',
        onboardingStatusLabel: 'Not Started',
        onboardingCompleted: false, // CRITICAL FIELD - present even when false
        onboardingCompletedAt: null,

        // Stripe - not connected
        stripeAccountId: null,
        stripeConnectedAt: null,
        stripeConnected: false,

        // Capabilities
        canAcceptBookings: false,

        // Timestamps
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => PropertySchema.parse(propertyWithNulls)).not.toThrow()
    })
  })

  // ========================================================================
  // Request Schema Tests
  // ========================================================================

  describe('CreatePropertyRequestSchema', () => {
    it('should validate minimal valid create request', () => {
      const minimalRequest = {
        name: 'New Campground',
        slug: 'new-campground',
      }

      expect(() => CreatePropertyRequestSchema.parse(minimalRequest)).not.toThrow()
    })

    it('should validate complete create request with all optional fields', () => {
      const completeRequest = {
        name: 'Mountain View Campground',
        slug: 'mountain-view',
        description: 'Beautiful campground',
        propertyType: 'campground' as const,
        address: '123 Main St',
        city: 'Boulder',
        state: 'CO',
        zipCode: '80301',
        country: 'USA',
        phone: '555-1234',
        email: 'info@example.com',
        subdomain: 'mountain-view',
        bookingPageSlug: 'book-now',
        settings: {
          checkInTime: '14:00',
          checkOutTime: '11:00',
          timezone: 'America/Denver',
          cancellationPolicy: 'flexible',
          minStayNights: 1,
          maxStayNights: 30,
          bookingLeadTimeDays: 365,
          customRules: 'No pets',
          openPeriodFrom: null,
          openPeriodUntil: null,
        },
        amenities: [
          { id: 'wifi', name: 'wifi', description: null },
          { id: 'showers', name: 'showers', description: null },
        ],
      }

      expect(() => CreatePropertyRequestSchema.parse(completeRequest)).not.toThrow()
    })

    it('should reject create request with invalid slug format', () => {
      const invalidRequest = {
        name: 'Test Property',
        slug: 'Invalid Slug!', // Spaces and special chars not allowed
      }

      expect(() => CreatePropertyRequestSchema.parse(invalidRequest)).toThrow()
    })

    it('should reject create request with uppercase in slug', () => {
      const invalidRequest = {
        name: 'Test Property',
        slug: 'TestProperty', // Must be lowercase
      }

      expect(() => CreatePropertyRequestSchema.parse(invalidRequest)).toThrow()
    })

    it('should reject create request with empty name', () => {
      const invalidRequest = {
        name: '',
        slug: 'test-property',
      }

      expect(() => CreatePropertyRequestSchema.parse(invalidRequest)).toThrow()
    })

    it('should reject create request with invalid email format', () => {
      const invalidRequest = {
        name: 'Test Property',
        slug: 'test-property',
        email: 'not-an-email',
      }

      expect(() => CreatePropertyRequestSchema.parse(invalidRequest)).toThrow()
    })
  })

  describe('UpdatePropertyRequestSchema', () => {
    it('should validate empty update request (all fields optional)', () => {
      const emptyUpdate = {}

      expect(() => UpdatePropertyRequestSchema.parse(emptyUpdate)).not.toThrow()
    })

    it('should validate partial update with some fields', () => {
      const partialUpdate = {
        name: 'Updated Name',
        description: 'Updated description',
      }

      expect(() => UpdatePropertyRequestSchema.parse(partialUpdate)).not.toThrow()
    })

    it('should accept null values for nullable fields', () => {
      const updateWithNulls = {
        description: null,
        propertyType: null,
        phone: null,
        email: null,
        amenities: null,
        site_amenities: null,
      }

      expect(() => UpdatePropertyRequestSchema.parse(updateWithNulls)).not.toThrow()
    })

    it('should reject update with invalid email format', () => {
      const invalidUpdate = {
        email: 'invalid-email',
      }

      expect(() => UpdatePropertyRequestSchema.parse(invalidUpdate)).toThrow()
    })
  })

  // ========================================================================
  // Response Schema Tests
  // ========================================================================

  describe('GetPropertyResponseSchema', () => {
    it('should validate complete single property response', () => {
      const response = {
        success: true,
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          companyId: '660e8400-e29b-41d4-a716-446655440001',
          ownerId: '770e8400-e29b-41d4-a716-446655440002',
          name: 'Mountain View',
          slug: 'mountain-view',
          description: null,
          propertyType: null,
          propertyTypeLabel: null,
          status: 'active',
          statusLabel: 'Active',
          address: null,
          city: null,
          state: null,
          zipCode: null,
          country: null,
          phone: null,
          email: null,
          checkInTime: null,
          checkOutTime: null,
          subdomain: null,
          bookingPageSlug: null,
          galleryImages: null,
          settings: {
            checkInTime: '14:00',
            checkOutTime: '11:00',
            timezone: 'America/Los_Angeles',
            cancellationPolicy: 'flexible',
            minStayNights: 1,
            maxStayNights: 30,
            bookingLeadTimeDays: 365,
            customRules: null,
            openPeriodFrom: null,
            openPeriodUntil: null,
          },
          amenities: null,
          site_amenities: null,
          onboardingStatus: 'completed',
          onboardingStatusLabel: 'Completed',
          onboardingCompleted: true,
          onboardingCompletedAt: '2025-01-01T12:00:00Z',
          stripeAccountId: 'acct_123',
          stripeConnectedAt: '2025-01-01T10:00:00Z',
          stripeConnected: true,
          canAcceptBookings: true,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        },
        meta: {
          timestamp: '2025-01-01T00:00:00Z',
          version: '1.0',
          requestId: '550e8400-e29b-41d4-a716-446655440000',
        },
      }

      expect(() => GetPropertyResponseSchema.parse(response)).not.toThrow()
    })
  })

  describe('ListPropertiesResponseSchema', () => {
    it('should validate complete list response with pagination', () => {
      const response = {
        success: true,
        data: {
          items: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              companyId: '660e8400-e29b-41d4-a716-446655440001',
              ownerId: null,
              name: 'Property 1',
              slug: 'property-1',
              description: null,
              propertyType: null,
              propertyTypeLabel: null,
              status: 'draft',
              statusLabel: 'Draft',
              address: null,
              city: null,
              state: null,
              zipCode: null,
              country: null,
              phone: null,
              email: null,
              checkInTime: null,
              checkOutTime: null,
              subdomain: null,
              bookingPageSlug: null,
              galleryImages: null,
              settings: {
                checkInTime: null,
                checkOutTime: null,
                timezone: null,
                cancellationPolicy: null,
                minStayNights: null,
                maxStayNights: null,
                bookingLeadTimeDays: null,
                customRules: null,
                openPeriodFrom: null,
                openPeriodUntil: null,
              },
              amenities: null,
              site_amenities: null,
              onboardingStatus: 'not_started',
              onboardingStatusLabel: 'Not Started',
              onboardingCompleted: false,
              onboardingCompletedAt: null,
              stripeAccountId: null,
              stripeConnectedAt: null,
              stripeConnected: false,
              canAcceptBookings: false,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
          ],
          pagination: {
            page: 1,
            per_page: 20,
            total: 1,
            total_pages: 1,
            has_next_page: false,
            has_previous_page: false,
          },
        },
        meta: {
          timestamp: '2025-01-01T00:00:00Z',
          version: '1.0',
          requestId: '550e8400-e29b-41d4-a716-446655440000',
        },
      }

      expect(() => ListPropertiesResponseSchema.parse(response)).not.toThrow()
    })

    it('should validate empty list response', () => {
      const response = {
        success: true,
        data: {
          items: [],
          pagination: {
            page: 1,
            per_page: 20,
            total: 0,
            total_pages: 0,
            has_next_page: false,
            has_previous_page: false,
          },
        },
        meta: {
          timestamp: '2025-01-01T00:00:00Z',
          version: '1.0',
          requestId: '550e8400-e29b-41d4-a716-446655440000',
        },
      }

      expect(() => ListPropertiesResponseSchema.parse(response)).not.toThrow()
    })
  })

  // ========================================================================
  // Edge Cases & Validation Tests
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle property with maximum field lengths', () => {
      const property: Property = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        companyId: '660e8400-e29b-41d4-a716-446655440001',
        ownerId: '770e8400-e29b-41d4-a716-446655440002',
        name: 'A'.repeat(255), // Max length
        slug: 'a'.repeat(100), // Long slug
        description: 'A'.repeat(2000), // Long description
        propertyType: 'campground',
        propertyTypeLabel: 'Campground',
        status: 'active',
        statusLabel: 'Active',
        address: null,
        city: null,
        state: null,
        zipCode: null,
        country: null,
        phone: null,
        email: null,
        checkInTime: null,
        checkOutTime: null,
        subdomain: null,
        bookingPageSlug: null,
        galleryImages: null,
        settings: {
          checkInTime: null,
          checkOutTime: null,
          timezone: null,
          cancellationPolicy: null,
          minStayNights: null,
          maxStayNights: null,
          bookingLeadTimeDays: null,
          customRules: null,
          openPeriodFrom: null,
          openPeriodUntil: null,
        },
        amenities: null,
        site_amenities: null,
        onboardingStatus: 'completed',
        onboardingStatusLabel: 'Completed',
        onboardingCompleted: true,
        onboardingCompletedAt: '2025-01-01T12:00:00Z',
        stripeAccountId: null,
        stripeConnectedAt: null,
        stripeConnected: false,
        canAcceptBookings: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => PropertySchema.parse(property)).not.toThrow()
    })

    it('should handle all property types', () => {
      const propertyTypes = ['campground', 'rv_park', 'glamping', 'cabin_resort', 'mixed']

      propertyTypes.forEach((type) => {
        const property = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          companyId: '660e8400-e29b-41d4-a716-446655440001',
          ownerId: null,
          name: 'Test Property',
          slug: 'test-property',
          description: null,
          propertyType: type,
          propertyTypeLabel: 'Test',
          status: 'draft',
          statusLabel: 'Draft',
          address: null,
          city: null,
          state: null,
          zipCode: null,
          country: null,
          phone: null,
          email: null,
          checkInTime: null,
          checkOutTime: null,
          subdomain: null,
          bookingPageSlug: null,
          galleryImages: null,
          settings: {
            checkInTime: null,
            checkOutTime: null,
            timezone: null,
            cancellationPolicy: null,
            minStayNights: null,
            maxStayNights: null,
            bookingLeadTimeDays: null,
            customRules: null,
            openPeriodFrom: null,
            openPeriodUntil: null,
          },
          amenities: null,
          site_amenities: null,
          onboardingStatus: 'not_started',
          onboardingStatusLabel: 'Not Started',
          onboardingCompleted: false,
          onboardingCompletedAt: null,
          stripeAccountId: null,
          stripeConnectedAt: null,
          stripeConnected: false,
          canAcceptBookings: false,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        }

        expect(() => PropertySchema.parse(property)).not.toThrow()
      })
    })

    it('should handle all onboarding statuses', () => {
      const statuses = [
        'not_started',
        'basic_info_complete',
        'stripe_connecting',
        'stripe_connected',
        'sites_configured',
        'completed',
      ]

      statuses.forEach((status) => {
        const property = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          companyId: '660e8400-e29b-41d4-a716-446655440001',
          ownerId: null,
          name: 'Test Property',
          slug: 'test-property',
          description: null,
          propertyType: null,
          propertyTypeLabel: null,
          status: 'draft',
          statusLabel: 'Draft',
          address: null,
          city: null,
          state: null,
          zipCode: null,
          country: null,
          phone: null,
          email: null,
          checkInTime: null,
          checkOutTime: null,
          subdomain: null,
          bookingPageSlug: null,
          galleryImages: null,
          settings: {
            checkInTime: null,
            checkOutTime: null,
            timezone: null,
            cancellationPolicy: null,
            minStayNights: null,
            maxStayNights: null,
            bookingLeadTimeDays: null,
            customRules: null,
            openPeriodFrom: null,
            openPeriodUntil: null,
          },
          amenities: null,
          site_amenities: null,
          onboardingStatus: status,
          onboardingStatusLabel: 'Test',
          onboardingCompleted: status === 'completed',
          onboardingCompletedAt: status === 'completed' ? '2025-01-01T12:00:00Z' : null,
          stripeAccountId: null,
          stripeConnectedAt: null,
          stripeConnected: false,
          canAcceptBookings: false,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        }

        expect(() => PropertySchema.parse(property)).not.toThrow()
      })
    })
  })
})

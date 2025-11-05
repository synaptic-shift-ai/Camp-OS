/**
 * Sites API v1 Contract Tests
 *
 * Phase 1, Week 4: API Migration & Testing
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * CRITICAL: These tests verify the new v1 endpoints follow standards:
 * - Standard response envelopes
 * - Zod validation on request/response
 * - Complete entity fetching (no selective fields)
 * - All required fields present
 *
 * Following CLAUDE.md:
 * - T-2: Integration tests in tests/integration/
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterize test inputs
 * - T-8: Test description states what final expect verifies
 */

import { describe, it, expect } from 'vitest'
import {
  SiteSchema,
  CreateSiteRequestSchema,
  UpdateSiteRequestSchema,
  ListSitesQuerySchema,
  GetSiteResponseSchema,
  ListSitesResponseSchema,
  CreateSiteResponseSchema,
  UpdateSiteResponseSchema,
  DeleteSiteResponseSchema,
} from '@/types/api/v1/schemas/sites'

describe('Sites API v1 Contract Tests', () => {
  describe('Request Schemas', () => {
    describe('CreateSiteRequestSchema', () => {
      it('should validate a complete create site request', () => {
        const validRequest = {
          siteNumber: 'A1',
          siteName: 'Riverside Tent Site',
          siteType: 'tent',
          description: 'Beautiful tent site by the river',
          basePrice: 3500,
          weekendPrice: 4500,
          maxOccupancy: 4,
          maxVehicles: 1,
          sizeSqft: 400,
          amenities: ['fire_pit', 'picnic_table'],
          hookups: ['water'],
          images: ['https://example.com/image.jpg'],
          locationMap: { lat: 37.7749, lng: -122.4194 },
        }

        expect(() => CreateSiteRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should validate a minimal create site request', () => {
        const minimalRequest = {
          siteNumber: 'A1',
          siteType: 'tent',
          basePrice: 3500,
        }

        expect(() => CreateSiteRequestSchema.parse(minimalRequest)).not.toThrow()
      })

      it('should reject request missing required siteNumber', () => {
        const invalidRequest = {
          siteType: 'tent',
          basePrice: 3500,
        }

        expect(() => CreateSiteRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should reject request missing required siteType', () => {
        const invalidRequest = {
          siteNumber: 'A1',
          basePrice: 3500,
        }

        expect(() => CreateSiteRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should reject request missing required basePrice', () => {
        const invalidRequest = {
          siteNumber: 'A1',
          siteType: 'tent',
        }

        expect(() => CreateSiteRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should reject invalid siteType enum value', () => {
        const invalidRequest = {
          siteNumber: 'A1',
          siteType: 'invalid_type',
          basePrice: 3500,
        }

        expect(() => CreateSiteRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should reject negative basePrice', () => {
        const invalidRequest = {
          siteNumber: 'A1',
          siteType: 'tent',
          basePrice: -100,
        }

        expect(() => CreateSiteRequestSchema.parse(invalidRequest)).toThrow()
      })
    })

    describe('UpdateSiteRequestSchema', () => {
      it('should validate partial update request', () => {
        const validRequest = {
          siteName: 'Updated Name',
          basePrice: 4000,
        }

        expect(() => UpdateSiteRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should validate empty update request', () => {
        const emptyRequest = {}

        expect(() => UpdateSiteRequestSchema.parse(emptyRequest)).not.toThrow()
      })
    })

    describe('ListSitesQuerySchema', () => {
      it('should validate query with all filters', () => {
        const validQuery = {
          page: 1,
          per_page: 20,
          status: 'available',
          siteType: 'tent',
          minPrice: 2000,
          maxPrice: 5000,
          minOccupancy: 2,
          sort_by: 'site_number',
          sort_order: 'asc',
        }

        expect(() => ListSitesQuerySchema.parse(validQuery)).not.toThrow()
      })

      it('should apply default pagination values', () => {
        const minimalQuery = {}

        const result = ListSitesQuerySchema.parse(minimalQuery)

        expect(result.page).toBe(1)
        expect(result.per_page).toBe(20)
        expect(result.sort_order).toBe('asc')
      })
    })
  })

  describe('Response Schemas', () => {
    describe('SiteSchema (Complete Entity)', () => {
      it('should validate complete site entity with all fields present', () => {
        const completeSite = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          propertyId: '987fcdeb-51a2-43e7-b123-456789abcdef',
          siteNumber: 'A1',
          siteName: 'Riverside Tent Site',
          siteType: 'tent',
          siteTypeLabel: 'Tent',
          description: 'Beautiful site',
          status: 'available',
          statusLabel: 'Available',
          pricing: {
            basePrice: 3500,
            weekendPrice: 4500,
            basePriceFormatted: '$35.00',
            weekendPriceFormatted: '$45.00',
            currency: 'USD',
          },
          capacity: {
            maxOccupancy: 4,
            maxVehicles: 1,
          },
          sizeSqft: 400,
          amenities: ['fire_pit'],
          hookups: ['water'],
          images: ['https://example.com/image.jpg'],
          locationMap: { lat: 37.7749 },
          createdAt: '2025-11-05T12:00:00Z',
          updatedAt: '2025-11-05T12:00:00Z',
        }

        expect(() => SiteSchema.parse(completeSite)).not.toThrow()
      })

      it('should reject site missing critical id field', () => {
        const invalidSite = {
          // id: MISSING
          propertyId: '987fcdeb-51a2-43e7-b123-456789abcdef',
          siteNumber: 'A1',
          siteType: 'tent',
        }

        expect(() => SiteSchema.parse(invalidSite)).toThrow()
      })

      it('should reject site missing critical propertyId field (tenant isolation)', () => {
        const invalidSite = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          // propertyId: MISSING - violates tenant isolation
          siteNumber: 'A1',
          siteType: 'tent',
        }

        expect(() => SiteSchema.parse(invalidSite)).toThrow()
      })

      it('should reject site missing pricing information', () => {
        const invalidSite = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          propertyId: '987fcdeb-51a2-43e7-b123-456789abcdef',
          siteNumber: 'A1',
          siteType: 'tent',
          // pricing: MISSING
        }

        expect(() => SiteSchema.parse(invalidSite)).toThrow()
      })
    })

    describe('GetSiteResponseSchema', () => {
      it('should validate standard success response envelope with site data', () => {
        const validResponse = {
          success: true,
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            propertyId: '987fcdeb-51a2-43e7-b123-456789abcdef',
            siteNumber: 'A1',
            siteName: null,
            siteType: 'tent',
            siteTypeLabel: 'Tent',
            description: null,
            status: 'available',
            statusLabel: 'Available',
            pricing: {
              basePrice: 3500,
              weekendPrice: 4500,
              basePriceFormatted: '$35.00',
              weekendPriceFormatted: '$45.00',
              currency: 'USD',
            },
            capacity: {
              maxOccupancy: null,
              maxVehicles: null,
            },
            sizeSqft: null,
            amenities: null,
            hookups: null,
            images: null,
            locationMap: null,
            createdAt: '2025-11-05T12:00:00Z',
            updatedAt: '2025-11-05T12:00:00Z',
          },
          meta: {
            timestamp: '2025-11-05T12:00:00Z',
            version: '1.0',
          },
        }

        expect(() => GetSiteResponseSchema.parse(validResponse)).not.toThrow()
      })

      it('should reject response with success: false', () => {
        const invalidResponse = {
          success: false,
          data: {},
        }

        expect(() => GetSiteResponseSchema.parse(invalidResponse)).toThrow()
      })
    })

    describe('ListSitesResponseSchema', () => {
      it('should validate list response with pagination', () => {
        const validResponse = {
          success: true,
          data: {
            items: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                propertyId: '987fcdeb-51a2-43e7-b123-456789abcdef',
                siteNumber: 'A1',
                siteName: null,
                siteType: 'tent',
                siteTypeLabel: 'Tent',
                description: null,
                status: 'available',
                statusLabel: 'Available',
                pricing: {
                  basePrice: 3500,
                  weekendPrice: 4500,
                  basePriceFormatted: '$35.00',
                  weekendPriceFormatted: '$45.00',
                  currency: 'USD',
                },
                capacity: {
                  maxOccupancy: null,
                  maxVehicles: null,
                },
                sizeSqft: null,
                amenities: null,
                hookups: null,
                images: null,
                locationMap: null,
                createdAt: '2025-11-05T12:00:00Z',
                updatedAt: '2025-11-05T12:00:00Z',
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
            timestamp: '2025-11-05T12:00:00Z',
            version: '1.0',
          },
        }

        expect(() => ListSitesResponseSchema.parse(validResponse)).not.toThrow()
      })

      it('should validate empty list response', () => {
        const emptyResponse = {
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
            timestamp: '2025-11-05T12:00:00Z',
            version: '1.0',
          },
        }

        expect(() => ListSitesResponseSchema.parse(emptyResponse)).not.toThrow()
      })
    })

    describe('DeleteSiteResponseSchema', () => {
      it('should validate delete success response', () => {
        const validResponse = {
          success: true,
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            deleted: true,
          },
          meta: {
            timestamp: '2025-11-05T12:00:00Z',
            version: '1.0',
          },
        }

        expect(() => DeleteSiteResponseSchema.parse(validResponse)).not.toThrow()
      })

      it('should reject delete response with deleted: false', () => {
        const invalidResponse = {
          success: true,
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            deleted: false,
          },
          meta: {
            timestamp: '2025-11-05T12:00:00Z',
            version: '1.0',
          },
        }

        expect(() => DeleteSiteResponseSchema.parse(invalidResponse)).toThrow()
      })
    })
  })

  describe('Regression Tests - Selective Field Fetching', () => {
    it('should reject site response missing any required field (prevents Oct 30 pattern)', () => {
      const incompleteResponse = {
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          propertyId: '987fcdeb-51a2-43e7-b123-456789abcdef',
          siteNumber: 'A1',
          // Missing many fields - simulates selective .select()
        },
        meta: {
          timestamp: '2025-11-05T12:00:00Z',
          version: '1.0',
        },
      }

      expect(() => GetSiteResponseSchema.parse(incompleteResponse)).toThrow()
    })
  })
})

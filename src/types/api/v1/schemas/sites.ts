/**
 * Site API Schemas
 *
 * Phase 1, Week 4: API Migration & Testing
 * Zod schemas for Site Management v1 API endpoints.
 *
 * Following IMPLEMENTATION_PLAN.md:
 * - Standard response envelopes
 * - Complete entity validation
 * - No selective field fetching
 *
 * Following CLAUDE.md:
 * - C-6: Use import type for type-only imports
 * - C-8: Prefer type over interface
 */

import { z } from 'zod'
import {
  createSuccessResponseSchema,
  createListResponseSchema,
  UuidSchema,
  DateStringSchema,
  CurrencyAmountSchema,
  PaginationParamsSchema,
} from './common'

// ============================================================================
// Site Type & Status Enums
// ============================================================================

export const SiteTypeSchema = z.enum([
  'tent',
  'rv',
  'cabin',
  'glamping',
  'yurt',
  'other',
])

export const ReservationTypeSchema = z.enum([
  'nightly',
  'weekly',
  'monthly',
  'seasonal',
])

export const SiteStatusSchema = z.enum([
  'available',
  'occupied',
  'reserved',
  'needs_housekeeping',
  'out_of_service',
  'booked',
])

// ============================================================================
// Site Pricing Schema
// ============================================================================

export const SitePricingSchema = z.object({
  basePrice: CurrencyAmountSchema,
  weekendPrice: CurrencyAmountSchema,
  basePriceFormatted: z.string(),
  weekendPriceFormatted: z.string(),
  currency: z.string(),
})

// ============================================================================
// Site Capacity Schema
// ============================================================================

export const SiteCapacitySchema = z.object({
  maxOccupancy: z.number().int().positive().nullable(),
  maxVehicles: z.number().int().positive().nullable(),
})

// ============================================================================
// Site Response Schema (Complete Entity)
// ============================================================================

/**
 * Complete Site entity schema
 *
 * CRITICAL: This represents the COMPLETE site entity.
 * Repository MUST use .select('*') to fetch all fields.
 * NO selective field fetching (prevents Oct 30 incident pattern).
 */
export const SiteSchema = z.object({
  id: UuidSchema,
  propertyId: UuidSchema,
  siteNumber: z.string().min(1),
  siteName: z.string().nullable(),
  siteType: SiteTypeSchema,
  siteTypeLabel: z.string(),
  description: z.string().nullable(),
  status: SiteStatusSchema,
  statusLabel: z.string(),
  pricing: SitePricingSchema,
  capacity: SiteCapacitySchema,
  sizeSqft: z.number().int().positive().nullable(),
  amenities: z.array(z.string()).nullable(),
  hookups: z.array(z.string()).nullable(),
  images: z.array(z.string()).nullable(),
  locationMap: z.record(z.any()).nullable(),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
})

export type Site = z.infer<typeof SiteSchema>

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create Site Request
 */
export const CreateSiteRequestSchema = z.object({
  siteNumber: z.string().min(1).max(50),
  siteName: z.string().max(255).optional(),
  siteType: SiteTypeSchema,
  description: z.string().max(2000).optional(),
  basePrice: CurrencyAmountSchema,
  weekendPrice: CurrencyAmountSchema.optional(),
  maxOccupancy: z.number().int().positive().optional(),
  maxVehicles: z.number().int().positive().optional(),
  sizeSqft: z.number().int().positive().optional(),
  amenities: z.array(z.string()).optional(),
  hookups: z.array(z.string()).optional(),
  images: z.array(z.string().url()).optional(),
  locationMap: z.record(z.any()).optional(),
  // Reservation type override: null means use property defaults
  enabledReservationTypesOverride: z.array(ReservationTypeSchema).nullable().optional(),
  // Seasonal rate override in cents
  seasonalRateCents: CurrencyAmountSchema.nullable().optional(),
})

export type CreateSiteRequest = z.infer<typeof CreateSiteRequestSchema>

/**
 * Update Site Request
 */
export const UpdateSiteRequestSchema = z.object({
  siteName: z.string().max(255).optional(),
  siteType: SiteTypeSchema.optional(),
  description: z.string().max(2000).optional(),
  basePrice: CurrencyAmountSchema.optional(),
  weekendPrice: CurrencyAmountSchema.optional(),
  maxOccupancy: z.number().int().positive().optional(),
  maxVehicles: z.number().int().positive().optional(),
  sizeSqft: z.number().int().positive().optional(),
  amenities: z.array(z.string()).optional(),
  hookups: z.array(z.string()).optional(),
  images: z.array(z.string().url()).optional(),
  locationMap: z.record(z.any()).optional(),
})

export type UpdateSiteRequest = z.infer<typeof UpdateSiteRequestSchema>

/**
 * Update Site Status Request
 */
export const UpdateSiteStatusRequestSchema = z.object({
  status: SiteStatusSchema,
})

export type UpdateSiteStatusRequest = z.infer<typeof UpdateSiteStatusRequestSchema>

/**
 * List Sites Query Parameters
 */
export const ListSitesQuerySchema = PaginationParamsSchema.extend({
  status: SiteStatusSchema.optional(),
  siteType: SiteTypeSchema.optional(),
  minPrice: CurrencyAmountSchema.optional(),
  maxPrice: CurrencyAmountSchema.optional(),
  minOccupancy: z.number().int().positive().optional(),
})

export type ListSitesQuery = z.infer<typeof ListSitesQuerySchema>

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Get Site Response
 */
export const GetSiteResponseSchema = createSuccessResponseSchema(SiteSchema)

export type GetSiteResponse = z.infer<typeof GetSiteResponseSchema>

/**
 * List Sites Response
 */
export const ListSitesResponseSchema = createListResponseSchema(SiteSchema)

export type ListSitesResponse = z.infer<typeof ListSitesResponseSchema>

/**
 * Create Site Response
 */
export const CreateSiteResponseSchema = createSuccessResponseSchema(SiteSchema)

export type CreateSiteResponse = z.infer<typeof CreateSiteResponseSchema>

/**
 * Update Site Response
 */
export const UpdateSiteResponseSchema = createSuccessResponseSchema(SiteSchema)

export type UpdateSiteResponse = z.infer<typeof UpdateSiteResponseSchema>

/**
 * Delete Site Response
 */
export const DeleteSiteResponseSchema = createSuccessResponseSchema(
  z.object({
    id: UuidSchema,
    deleted: z.literal(true),
  })
)

export type DeleteSiteResponse = z.infer<typeof DeleteSiteResponseSchema>

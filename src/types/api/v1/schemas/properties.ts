/**
 * Properties API v1 - Zod Schemas
 *
 * Phase 2, Week 5-6: Property Management Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * CRITICAL: Complete entity schemas to prevent Oct 30 incident
 * - onboarding_completed MUST be present
 * - All fields explicitly validated
 * - Contract tests verify schema completeness
 */

import { z } from 'zod'

// ============================================================================
// Base Schemas
// ============================================================================

export const PropertyTypeSchema = z.enum([
  'campground',
  'rv_park',
  'glamping',
  'cabin_resort',
  'mixed',
])

export const PropertyStatusSchema = z.enum(['draft', 'active', 'inactive', 'closed'])

export const OnboardingStatusSchema = z.enum([
  'not_started',
  'basic_info_complete',
  'stripe_connecting',
  'stripe_connected',
  'sites_configured',
  'completed',
])

export const PropertySettingsSchema = z.object({
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
  timezone: z.string().nullable(),
  cancellationPolicy: z.string().nullable(),
  minStayNights: z.number().int().positive().nullable(),
  maxStayNights: z.number().int().positive().nullable(),
  bookingLeadTimeDays: z.number().int().min(0).nullable(),
  customRules: z.string().nullable(),
  freeCancellationWindow: z.number().int().min(0).nullable(),
  cancellationRefundPercentage: z.number().int().min(0).max(100).nullable(),
  cancellationNonRefundableDays: z.number().int().min(0).nullable(),
  cancellationRefundProcessingWindow: z.number().int().min(0).nullable(),
})

// ============================================================================
// Property Response Schema
// ============================================================================

/**
 * CRITICAL: Complete property entity schema
 * Oct 30 Fix: onboarding_completed is REQUIRED
 */
export const PropertySchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  ownerId: z.string().uuid().nullable(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  propertyType: PropertyTypeSchema.nullable(),
  propertyTypeLabel: z.string().nullable(),
  status: PropertyStatusSchema,
  statusLabel: z.string(),

  // Location
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  country: z.string().nullable(),

  // Contact
  phone: z.string().nullable(),
  email: z.string().email().nullable().or(z.literal('')),
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),

  // Branding
  subdomain: z.string().nullable(),
  bookingPageSlug: z.string().nullable(),

  // Settings
  settings: PropertySettingsSchema,

  // Amenities
  amenities: z.array(z.string()).nullable(),

  // Onboarding (CRITICAL - Oct 30 fix)
  onboardingStatus: OnboardingStatusSchema,
  onboardingStatusLabel: z.string(),
  onboardingCompleted: z.boolean(), // CRITICAL: Must be present
  onboardingCompletedAt: z.string().datetime().nullable(),

  // Stripe Connect
  stripeAccountId: z.string().nullable(),
  stripeConnectedAt: z.string().datetime().nullable(),
  stripeConnected: z.boolean(),

  // Capabilities
  canAcceptBookings: z.boolean(),

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Property = z.infer<typeof PropertySchema>

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create Property Request
 */
export const CreatePropertyRequestSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase with hyphens only',
  }),
  description: z.string().max(2000).optional(),
  propertyType: PropertyTypeSchema.optional(),

  // Location
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),

  // Contact
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),

  // Branding
  subdomain: z.string().max(100).optional(),
  bookingPageSlug: z.string().max(100).optional(),

  // Settings
  settings: PropertySettingsSchema.optional(),

  // Amenities
  amenities: z.array(z.string()).optional(),
})

export type CreatePropertyRequest = z.infer<typeof CreatePropertyRequestSchema>

/**
 * Update Property Request
 */
export const UpdatePropertyRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  propertyType: PropertyTypeSchema.nullable().optional(),

  // Location
  address: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zipCode: z.string().max(20).nullable().optional(),
  country: z.string().max(100).nullable().optional(),

  // Contact
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  checkInTime: z.string().max(500).nullable().optional(),
  checkOutTime: z.string().max(500).nullable().optional(),

  // Branding
  subdomain: z.string().max(100).nullable().optional(),
  bookingPageSlug: z.string().max(100).nullable().optional(),
  heroImageUrl: z.string().max(2000).nullable().optional(),

  // Settings (partial updates allowed - not all fields required)
  settings: PropertySettingsSchema.partial().optional(),

  // Amenities
  amenities: z.array(z.string()).nullable().optional(),

  // Guest Instructions
  checkInInstructions: z.string().max(5000).nullable().optional(),
  checkOutInstructions: z.string().max(5000).nullable().optional(),
  houseRules: z.string().max(5000).nullable().optional(),
})

export type UpdatePropertyRequest = z.infer<typeof UpdatePropertyRequestSchema>

/**
 * List Properties Query Parameters
 */
export const ListPropertiesQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  per_page: z.number().int().positive().max(100).default(20),
  status: PropertyStatusSchema.optional(),
  onboarding_complete: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
})

export type ListPropertiesQuery = z.infer<typeof ListPropertiesQuerySchema>

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Standard API response metadata
 */
const ApiMetaSchema = z.object({
  timestamp: z.string().datetime(),
  version: z.string(),
  requestId: z.string().uuid(),
  pagination: z.object({
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
    has_next_page: z.boolean(),
    has_previous_page: z.boolean(),
  }).optional(),
})

/**
 * Single property response (GET /api/v1/properties/:id)
 */
export const GetPropertyResponseSchema = z.object({
  success: z.literal(true),
  data: PropertySchema,
  meta: ApiMetaSchema,
})

/**
 * List properties response (GET /api/v1/properties)
 */
export const ListPropertiesResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(PropertySchema),
    pagination: z.object({
      page: z.number().int().positive(),
      per_page: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      total_pages: z.number().int().nonnegative(),
      has_next_page: z.boolean(),
      has_previous_page: z.boolean(),
    }),
  }),
  meta: ApiMetaSchema,
})

/**
 * Create property response (POST /api/v1/properties)
 */
export const CreatePropertyResponseSchema = z.object({
  success: z.literal(true),
  data: PropertySchema,
  meta: ApiMetaSchema,
})

/**
 * Update property response (PATCH /api/v1/properties/:id)
 */
export const UpdatePropertyResponseSchema = z.object({
  success: z.literal(true),
  data: PropertySchema,
  meta: ApiMetaSchema,
})

export type GetPropertyResponse = z.infer<typeof GetPropertyResponseSchema>
export type ListPropertiesResponse = z.infer<typeof ListPropertiesResponseSchema>
export type CreatePropertyResponse = z.infer<typeof CreatePropertyResponseSchema>
export type UpdatePropertyResponse = z.infer<typeof UpdatePropertyResponseSchema>

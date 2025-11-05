/**
 * Property API Response Schemas
 *
 * Phase 1.4: Properties API Contract Tests
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 * Reference: docs/architecture/API_CONTRACT_SAFETY.md
 * Reference: docs/api/API_AUDIT.md
 *
 * CRITICAL: These schemas prevent the Oct 30, 2025 incident where missing
 * onboarding_completed field caused infinite redirect loops.
 *
 * Purpose:
 * - Runtime validation at API boundaries
 * - Type-safe API responses
 * - Early detection of schema drift
 * - Clear contract between API and consumers
 * - Single source of truth for API shapes
 *
 * Following CLAUDE.md:
 * - C-5: Branded types for domain IDs
 * - C-6: Use import type for type-only imports
 * - C-8: Prefer type over interface
 * - D-2: Multi-tenant isolation (company_id required)
 * - BP-4: Enforce tenant context in all queries
 *
 * Following API_CONTRACT_SAFETY.md:
 * - Runtime validation with Zod
 * - Generated types match database schema
 * - Fail-fast validation
 * - Observable validation failures
 */

import { z } from 'zod'
import type { Database } from '@/contracts/db'

// ============================================================================
// Property Response Schema
// ============================================================================

/**
 * Property schema for API responses
 *
 * CRITICAL FIELDS (DO NOT MAKE OPTIONAL):
 * - id: Required for all property operations
 * - name: Required for display in wizard and dashboard
 * - slug: Required for URL routing and bookings
 * - company_id: Required for multi-tenant isolation (D-2, BP-4)
 * - onboarding_completed: Required for middleware wizard logic (ADR-001)
 *
 * These fields were MISSING in the Oct 30 incident, causing:
 * 1. Infinite redirect loops (middleware couldn't check onboarding status)
 * 2. Silent failures (frontend showed infinite loading, no errors)
 * 3. Complete conversion pipeline failure
 * 4. Investor demo failure
 *
 * ARCHITECTURE DECISION:
 * We use SELECT * in the API to ensure ALL fields are returned.
 * This prevents selective fetching bugs (Anti-Pattern #1 from API_AUDIT.md).
 * Runtime validation ensures the response matches this schema.
 *
 * If you need a projection (subset of fields), create a NEW endpoint
 * with an EXPLICIT schema, don't use selective SELECTs.
 */
export const PropertyResponseSchema = z.object({
  // === CRITICAL IDENTITY FIELDS ===
  id: z.string().uuid('Property ID must be a valid UUID'),
  slug: z.string().min(1, 'Property slug is required'),

  // === CRITICAL BUSINESS FIELDS ===
  name: z.string().min(1, 'Property name is required'),
  company_id: z.string().uuid('Company ID must be a valid UUID'), // TENANT ISOLATION
  onboarding_completed: z.boolean(), // CRITICAL: Middleware depends on this

  // === REQUIRED AUDIT FIELDS ===
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),

  // === LOCATION FIELDS ===
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip_code: z.string().nullable(),
  country: z.string().nullable(),

  // === CONTACT FIELDS ===
  phone: z.string().nullable(),
  email: z.string().email('Invalid email format').nullable().or(z.literal('')),

  // === PROPERTY DETAILS ===
  description: z.string().nullable(),
  property_type: z.string().nullable(),
  timezone: z.string().nullable(),
  check_in_time: z.string().nullable(),
  check_out_time: z.string().nullable(),
  status: z.string().nullable(),

  // === BRANDING FIELDS ===
  subdomain: z.string().nullable(),

  // === JSON FIELDS ===
  amenities: z.any().nullable(), // JSONB field
  settings: z.any().nullable(),  // JSONB field

  // === OWNERSHIP ===
  owner_id: z.string().uuid('Owner ID must be a valid UUID').nullable(),

  // === ONBOARDING TRACKING ===
  stripe_account_id: z.string().nullable(),
  stripe_connected_at: z.string().datetime().nullable(),
  booking_page_slug: z.string().nullable(),
  onboarding_completed_at: z.string().datetime().nullable(),
})

/**
 * Properties list response schema
 *
 * This is what /api/onboarding/properties returns.
 * Validates the entire response structure, not just individual properties.
 *
 * Following API_CONTRACT_SAFETY.md recommendations:
 * - Wrap data in envelope for consistency
 * - Include metadata for observability
 */
export const PropertyListResponseSchema = z.object({
  properties: z.array(PropertyResponseSchema),
})

/**
 * Error response schema
 *
 * Standard error format for API responses
 * Following API_AUDIT.md standardization goals
 */
export const PropertyErrorResponseSchema = z.object({
  error: z.string().min(1, 'Error message is required'),
})

// ============================================================================
// TypeScript Types (inferred from schemas)
// ============================================================================

export type PropertyResponse = z.infer<typeof PropertyResponseSchema>
export type PropertyListResponse = z.infer<typeof PropertyListResponseSchema>
export type PropertyErrorResponse = z.infer<typeof PropertyErrorResponseSchema>

// ============================================================================
// Branded Types (C-5: Use branded types for domain IDs)
// ============================================================================

/**
 * Branded type for Property ID
 *
 * Prevents mixing property IDs with other string IDs at compile time
 */
export type PropertyId = PropertyResponse['id'] & { readonly __brand: 'PropertyId' }

/**
 * Branded type for Company ID
 *
 * Enforces tenant isolation at type level
 */
export type CompanyId = PropertyResponse['company_id'] & { readonly __brand: 'CompanyId' }

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate property response
 *
 * Use this to validate API responses at runtime.
 * Throws ZodError if validation fails.
 *
 * Following API_CONTRACT_SAFETY.md:
 * - Fail-fast validation
 * - Clear error messages
 *
 * @param data - Raw data from API
 * @returns Validated and typed property
 * @throws ZodError if validation fails
 */
export function validatePropertyResponse(data: unknown): PropertyResponse {
  return PropertyResponseSchema.parse(data)
}

/**
 * Validate properties list response
 *
 * Use this in /api/onboarding/properties route.
 * This validation would have caught the Oct 30 incident.
 *
 * @param data - Raw data from API
 * @returns Validated and typed properties list
 * @throws ZodError if validation fails
 */
export function validatePropertyListResponse(data: unknown): PropertyListResponse {
  return PropertyListResponseSchema.parse(data)
}

/**
 * Safe validation (returns success/error instead of throwing)
 *
 * Use this when you want to handle validation errors gracefully
 * without try/catch blocks.
 *
 * Following API_CONTRACT_SAFETY.md observable validation pattern.
 *
 * @param data - Raw data from API
 * @returns Validation result with success flag
 */
export function safeValidatePropertyListResponse(
  data: unknown
): { success: true; data: PropertyListResponse } | { success: false; error: z.ZodError } {
  const result = PropertyListResponseSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, error: result.error }
  }
}

/**
 * Format validation errors for logging
 *
 * Converts Zod errors to structured format for monitoring
 *
 * @param error - Zod validation error
 * @returns Formatted error details
 */
export function formatValidationError(error: z.ZodError): {
  fields: Array<{ field: string; message: string }>
  summary: string
} {
  const fields = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  const summary = `Validation failed for ${fields.length} field(s): ${fields.map((f) => f.field).join(', ')}`

  return { fields, summary }
}

// ============================================================================
// Server-Side Validation Helper
// ============================================================================

/**
 * Validate and log API response on server
 *
 * Use this in API routes to ensure responses match schema BEFORE sending.
 * Logs validation failures for observability.
 *
 * Following API_CONTRACT_SAFETY.md:
 * - Server-side validation prevents invalid responses
 * - Observable validation failures
 * - Clear error messages for debugging
 *
 * @param data - Response data to validate
 * @param endpoint - API endpoint path (for logging)
 * @returns Validated data or throws with detailed error
 */
export function validateApiResponse(
  data: unknown,
  endpoint: string
): PropertyListResponse {
  const result = PropertyListResponseSchema.safeParse(data)

  if (!result.success) {
    const formattedError = formatValidationError(result.error)

    // Log validation failure prominently
    console.error('========================================')
    console.error('🚨 API RESPONSE VALIDATION FAILED 🚨')
    console.error('========================================')
    console.error('This indicates a schema mismatch or database issue.')
    console.error('')
    console.error('Details:')
    console.error(`  Endpoint: ${endpoint}`)
    console.error(`  Summary: ${formattedError.summary}`)
    console.error(`  Fields:`)
    formattedError.fields.forEach((f) => {
      console.error(`    - ${f.field}: ${f.message}`)
    })
    console.error('')
    console.error('Action Required:')
    console.error('  1. Check database schema matches type definitions')
    console.error('  2. Verify SELECT * is used (no selective fetching)')
    console.error('  3. Run npm run gen:db to regenerate types')
    console.error('  4. Review recent migrations for schema changes')
    console.error('========================================')

    // TODO: Send to monitoring service (Sentry, DataDog)
    // trackApiValidationFailure(endpoint, result.error, data)

    throw new Error(`API validation failed for ${endpoint}: ${formattedError.summary}`)
  }

  return result.data
}

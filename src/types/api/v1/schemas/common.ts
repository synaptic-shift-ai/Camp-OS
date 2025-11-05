/**
 * Common API Schemas
 *
 * Reusable Zod schemas for common patterns across all APIs.
 * These ensure consistency in validation and response formats.
 */

import { z } from "zod"

/**
 * Standard metadata for all API responses.
 */
export const ApiMetaSchema = z.object({
  timestamp: z.string().datetime(),
  version: z.string(),
  request_id: z.string().uuid().optional()
})

/**
 * Standard success response envelope.
 *
 * All successful API responses should use this format.
 */
export function createSuccessResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: ApiMetaSchema
  })
}

/**
 * Standard error response envelope.
 *
 * All error responses should use this format.
 */
export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  }),
  meta: ApiMetaSchema
})

/**
 * Pagination parameters (for list endpoints).
 */
export const PaginationParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  per_page: z.number().int().positive().max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('asc')
})

/**
 * Pagination metadata in responses.
 */
export const PaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  per_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative()
})

/**
 * UUID validation (commonly used for IDs).
 */
export const UuidSchema = z.string().uuid()

/**
 * ISO 8601 date string validation.
 */
export const DateStringSchema = z.string().datetime()

/**
 * Date-only string validation (YYYY-MM-DD).
 */
export const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * Email validation.
 */
export const EmailSchema = z.string().email()

/**
 * Phone number validation (flexible format).
 */
export const PhoneSchema = z.string().regex(/^[\d\s\-\(\)\+]+$/).optional()

/**
 * Currency amount in cents (avoids floating point issues).
 */
export const CurrencyAmountSchema = z.number().int().nonnegative()

/**
 * Percentage (0-100).
 */
export const PercentageSchema = z.number().min(0).max(100)

/**
 * URL validation.
 */
export const UrlSchema = z.string().url()

/**
 * Slug validation (lowercase, alphanumeric with hyphens).
 */
export const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

/**
 * Status enum used across multiple entities.
 */
export const StatusSchema = z.enum([
  'active',
  'inactive',
  'pending',
  'archived'
])

/**
 * Timestamps that appear on all database entities.
 */
export const TimestampsSchema = z.object({
  created_at: DateStringSchema,
  updated_at: DateStringSchema
})

/**
 * Helper to create a single entity response schema.
 *
 * @example
 * const PropertyResponseSchema = createSingleResponseSchema(PropertySchema)
 */
export function createSingleResponseSchema<T extends z.ZodType>(entitySchema: T) {
  return createSuccessResponseSchema(entitySchema)
}

/**
 * Helper to create a list response schema.
 *
 * @example
 * const PropertyListResponseSchema = createListResponseSchema(PropertySchema)
 */
export function createListResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return createSuccessResponseSchema(
    z.object({
      items: z.array(itemSchema),
      pagination: PaginationMetaSchema
    })
  )
}

/**
 * Helper to create an ID parameter schema.
 */
export const IdParamSchema = z.object({
  id: UuidSchema
})

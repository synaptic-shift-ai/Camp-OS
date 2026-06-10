/**
 * Guests API v1 - Zod Schemas
 *
 * Phase 2, Week 7: Guest Management Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * CRITICAL: Complete entity schemas to prevent Oct 30 incident pattern
 * - All fields explicitly validated
 * - Contract tests verify schema completeness
 */

import { z } from 'zod'
import { ZIP_CODE_MIN_LENGTH } from '@/lib/postal-code'
import {
  createSuccessResponseSchema,
  createListResponseSchema,
  UuidSchema,
  DateStringSchema,
} from './common'

// ============================================================================
// Address Schema
// ============================================================================

export const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(ZIP_CODE_MIN_LENGTH),
  country: z.string().min(1),
})

export type Address = z.infer<typeof AddressSchema>

// ============================================================================
// Emergency Contact Schema
// ============================================================================

export const EmergencyContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
})

export type EmergencyContact = z.infer<typeof EmergencyContactSchema>

// ============================================================================
// Guest Response Schema (Complete Entity)
// ============================================================================

/**
 * Complete Guest entity schema
 *
 * CRITICAL: This represents the COMPLETE guest entity.
 * Repository MUST use .select('*') to fetch all fields.
 * NO selective field fetching (prevents Oct 30 incident pattern).
 */
export const GuestSchema = z.object({
  id: UuidSchema,
  propertyId: UuidSchema,
  userId: UuidSchema.nullable(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: AddressSchema.nullable(),
  emergencyContact: EmergencyContactSchema.nullable(),
  hasStripeCustomer: z.boolean(),
  stripeCustomerId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
})

export type Guest = z.infer<typeof GuestSchema>

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create Guest Request
 *
 * Required fields for creating a new guest.
 * Email must be unique per property (enforced at application layer).
 */
export const CreateGuestRequestSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(1).max(20),
  address: AddressSchema.optional(),
  emergencyContactName: z.string().min(1).max(100).optional(),
  emergencyContactPhone: z.string().min(1).max(20).optional(),
  userId: UuidSchema.optional(),
  notes: z.string().max(1000).optional(),
})

export type CreateGuestRequest = z.infer<typeof CreateGuestRequestSchema>

/**
 * Update Guest Request
 *
 * All fields optional - partial updates supported.
 */
export const UpdateGuestRequestSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).max(20).optional(),
  address: AddressSchema.nullable().optional(),
  emergencyContactName: z.string().min(1).max(100).nullable().optional(),
  emergencyContactPhone: z.string().min(1).max(20).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export type UpdateGuestRequest = z.infer<typeof UpdateGuestRequestSchema>

/**
 * Link Stripe Customer Request
 *
 * Links a Stripe Customer ID to a guest for saved payment methods.
 */
export const LinkStripeCustomerRequestSchema = z.object({
  stripeCustomerId: z.string().regex(/^cus_[a-zA-Z0-9]+$/),
})

export type LinkStripeCustomerRequest = z.infer<typeof LinkStripeCustomerRequestSchema>

/**
 * List Guests Query Parameters
 *
 * Filter and pagination for guest listing.
 */
export const ListGuestsQuerySchema = z.object({
  email: z.string().email().optional(),
  hasStripeCustomer: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100))
    .optional(),
  offset: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(0))
    .optional(),
})

export type ListGuestsQuery = z.infer<typeof ListGuestsQuerySchema>

// ============================================================================
// Response Schemas
// ============================================================================

export const GuestResponseSchema = createSuccessResponseSchema(GuestSchema)
export type GuestResponse = z.infer<typeof GuestResponseSchema>

export const GuestListResponseSchema = createListResponseSchema(GuestSchema)
export type GuestListResponse = z.infer<typeof GuestListResponseSchema>

// ============================================================================
// Export All
// ============================================================================

export const GuestSchemas = {
  // Entity
  Guest: GuestSchema,
  Address: AddressSchema,
  EmergencyContact: EmergencyContactSchema,

  // Requests
  CreateGuestRequest: CreateGuestRequestSchema,
  UpdateGuestRequest: UpdateGuestRequestSchema,
  LinkStripeCustomerRequest: LinkStripeCustomerRequestSchema,
  ListGuestsQuery: ListGuestsQuerySchema,

  // Responses
  GuestResponse: GuestResponseSchema,
  GuestListResponse: GuestListResponseSchema,
}

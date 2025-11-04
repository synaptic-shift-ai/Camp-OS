/**
 * Zod Validation Schemas
 *
 * All Zod schemas for request/response validation.
 * Used at API boundaries (server actions, API routes, webhooks)
 *
 * RULES:
 * - Import these schemas, not define new ones in components
 * - Keep in sync with DTOs in booking.ts
 * - Add observability on parse failures (Phase 4)
 */

import { z } from 'zod'

// ============================================================================
// Enum Schemas
// ============================================================================

export const SiteTypeSchema = z.enum(['tent', 'rv', 'cabin', 'glamping', 'yurt', 'other'])
export const SiteStatusSchema = z.enum(['available', 'unavailable', 'maintenance'])

export const ReservationStatusSchema = z.enum([
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
])

export const ReservationPaymentStatusSchema = z.enum(['unpaid', 'partial', 'paid', 'refunded'])

export const PaymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded'])

export const PaymentMethodSchema = z.enum([
  'credit_card',
  'debit_card',
  'cash',
  'check',
  'bank_transfer',
  'other',
])

// ============================================================================
// Request Schemas
// ============================================================================

export const CreateGuestSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(50),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  emergencyContactName: z.string().max(255).optional(),
  emergencyContactPhone: z.string().max(50).optional(),
})

export const CreateReservationSchema = z.object({
  propertyId: z.string().uuid(),
  siteId: z.string().uuid(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numAdults: z.number().int().min(1).max(20),
  numChildren: z.number().int().min(0).max(20).optional(),
  numPets: z.number().int().min(0).max(10).optional(),
  numVehicles: z.number().int().min(0).max(5).optional(),
  guest: CreateGuestSchema,
  specialRequests: z.string().max(2000).optional(),
})

export const CreatePaymentIntentRequestSchema = z.object({
  reservation_id: z.string().uuid(),
  property_id: z.string().uuid(),
})

export const CreatePaymentIntentResponseSchema = z.object({
  clientSecret: z.string(),
  paymentIntentId: z.string(),
})

// ============================================================================
// Stripe Webhook Schemas
// ============================================================================

export const StripeWebhookMetadataSchema = z.object({
  reservation_id: z.string().uuid(),
  property_id: z.string().uuid(),
  confirmation_number: z.string(),
  guest_email: z.string().email(),
  guest_id: z.string().uuid(),
})

export const StripePaymentIntentSucceededSchema = z.object({
  id: z.string(),
  object: z.literal('payment_intent'),
  amount: z.number().int().positive(),
  currency: z.string(),
  status: z.literal('succeeded'),
  payment_method: z.union([z.string(), z.null()]).optional(), // PaymentMethod ID or null
  metadata: StripeWebhookMetadataSchema,
})

// ============================================================================
// Form Schemas (for react-hook-form)
// ============================================================================

export const GuestFormSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  country: z.string().default('United States'),
  special_requests: z.string().optional(),
  email_preferences: z.boolean().default(false),
})

export type GuestFormData = z.infer<typeof GuestFormSchema>

/**
 * Reservations API v1 - Zod Schemas
 *
 * Phase 2, Week 9-10: Booking Engine Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * Validation schemas for reservation API requests and responses.
 */

import { z } from 'zod'

// ============================================================================
// Enum Schemas
// ============================================================================

export const ReservationStatusSchema = z.enum([
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'completed',
  'cancelled',
])

export const PaymentStatusSchema = z.enum(['pending', 'partial', 'paid', 'refunded'])

export const PaymentMethodSchema = z.enum([
  'credit_card',
  'debit_card',
  'cash',
  'check',
  'bank_transfer',
  'stripe',
  'other',
])

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create Reservation Request
 * POST /api/v1/properties/[propertyId]/reservations
 */
export const CreateReservationRequestSchema = z.object({
  siteId: z.string().uuid('Site ID must be a valid UUID'),
  guestId: z.string().uuid('Guest ID must be a valid UUID'),
  checkIn: z.string().datetime('Check-in must be a valid ISO 8601 datetime'),
  checkOut: z.string().datetime('Check-out must be a valid ISO 8601 datetime'),
  occupancy: z.object({
    numAdults: z.number().int().min(1, 'At least 1 adult required').max(20),
    numChildren: z.number().int().min(0).max(20).optional().default(0),
    numPets: z.number().int().min(0).max(10).optional().default(0),
    numVehicles: z.number().int().min(0).max(5).optional().default(1),
  }),
  totalAmountCents: z.number().int().min(0, 'Amount cannot be negative'),
  specialRequests: z.string().max(1000).optional().nullable(),
  source: z.string().max(50).optional().default('online'),
})

export type CreateReservationRequest = z.infer<typeof CreateReservationRequestSchema>

/**
 * Record Payment Request
 * POST /api/v1/reservations/[id]/payment
 */
export const RecordPaymentRequestSchema = z.object({
  amountCents: z.number().int().min(1, 'Payment amount must be positive'),
  paymentMethod: PaymentMethodSchema,
  stripePaymentIntentId: z.string().optional().nullable(),
})

export type RecordPaymentRequest = z.infer<typeof RecordPaymentRequestSchema>

/**
 * Cancel Reservation Request
 * POST /api/v1/reservations/[id]/cancel
 */
export const CancelReservationRequestSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
  refundAmountCents: z.number().int().min(0, 'Refund amount cannot be negative'),
})

export type CancelReservationRequest = z.infer<typeof CancelReservationRequestSchema>

/**
 * Check-In Request
 * POST /api/v1/reservations/[id]/check-in
 */
export const CheckInRequestSchema = z.object({
  balancePaidCents: z.number().int().min(0).optional().default(0),
  notes: z.string().max(1000).optional().nullable(),
})

export type CheckInRequest = z.infer<typeof CheckInRequestSchema>

/**
 * Check-Out Request
 * POST /api/v1/reservations/[id]/check-out
 */
export const CheckOutRequestSchema = z.object({
  hasDamages: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().nullable(),
})

export type CheckOutRequest = z.infer<typeof CheckOutRequestSchema>

/**
 * List Reservations Request (Query Params)
 * GET /api/v1/properties/[propertyId]/reservations
 */
export const ListReservationsQuerySchema = z.object({
  status: ReservationStatusSchema.optional(),
  guestId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  checkInFrom: z.string().datetime().optional(),
  checkInTo: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
})

export type ListReservationsQuery = z.infer<typeof ListReservationsQuerySchema>

/**
 * Check Site Availability Request (Query Params)
 * GET /api/v1/sites/[siteId]/availability
 */
export const CheckAvailabilityQuerySchema = z.object({
  checkIn: z.string().datetime('Check-in must be a valid ISO 8601 datetime'),
  checkOut: z.string().datetime('Check-out must be a valid ISO 8601 datetime'),
})

export type CheckAvailabilityQuery = z.infer<typeof CheckAvailabilityQuerySchema>

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Reservation Response
 * Complete reservation entity for API responses
 */
export const ReservationResponseSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  siteId: z.string().uuid(),
  guestId: z.string().uuid(),
  confirmationNumber: z.string(),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  nights: z.number().int().positive(),
  occupancy: z.object({
    numAdults: z.number().int(),
    numChildren: z.number().int(),
    numPets: z.number().int(),
    numVehicles: z.number().int(),
    totalPeople: z.number().int(),
  }),
  totalAmountCents: z.number().int(),
  totalAmountDollars: z.number(),
  paidAmountCents: z.number().int(),
  paidAmountDollars: z.number(),
  balanceCents: z.number().int(),
  balanceDollars: z.number(),
  status: ReservationStatusSchema,
  paymentStatus: PaymentStatusSchema,
  specialRequests: z.string().nullable(),
  notes: z.string().nullable(),
  source: z.string(),
  checkedInAt: z.string().datetime().nullable(),
  checkedInBy: z.string().uuid().nullable(),
  checkInNotes: z.string().nullable(),
  checkedOutAt: z.string().datetime().nullable(),
  checkedOutBy: z.string().uuid().nullable(),
  hasDamages: z.boolean(),
  checkOutNotes: z.string().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  cancellationReason: z.string().nullable(),
  refundAmountCents: z.number().int().nullable(),
  refundAmountDollars: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ReservationResponse = z.infer<typeof ReservationResponseSchema>

/**
 * Reservation List Response
 */
export const ReservationListResponseSchema = z.object({
  reservations: z.array(ReservationResponseSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export type ReservationListResponse = z.infer<typeof ReservationListResponseSchema>

/**
 * Site Availability Response
 */
export const SiteAvailabilityResponseSchema = z.object({
  siteId: z.string().uuid(),
  isAvailable: z.boolean(),
  conflictingReservations: z.array(
    z.object({
      id: z.string().uuid(),
      confirmationNumber: z.string(),
      checkInDate: z.string().datetime(),
      checkOutDate: z.string().datetime(),
      status: ReservationStatusSchema,
    })
  ),
})

export type SiteAvailabilityResponse = z.infer<typeof SiteAvailabilityResponseSchema>

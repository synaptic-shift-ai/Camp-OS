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
  'partially_refunded',
  'cancelled',
  'no_show',
])

export const PaymentStatusSchema = z.enum(['pending', 'partial', 'paid', 'partially_refunded', 'refunded'])

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
  refundPaymentMethod: z.string().max(100).optional().nullable(),
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

// ============================================================================
// Manual Reservation Schemas (Phone/Walk-in Bookings)
// ============================================================================

/**
 * Spouse/Partner Information Schema
 */
export const SpousePartnerInputSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  isAlternateContact: z.boolean().default(false),
})

export type SpousePartnerInput = z.infer<typeof SpousePartnerInputSchema>

/**
 * Child Information Schema
 */
export const ChildInputSchema = z.object({
  firstName: z.string().min(1).max(100),
  age: z.number().int().min(0).max(17).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  specialNeedsAllergies: z.string().max(1000).optional().nullable(),
})

export type ChildInput = z.infer<typeof ChildInputSchema>

export const PetTypeSchema = z.enum(['dog', 'cat', 'bird', 'other'])
export const PetInputSchema = z.object({
  name: z.string().min(1).max(100),
  type: PetTypeSchema,
  breed: z.string().max(100).optional().nullable(),
  weightLbs: z.number().min(0).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})
export type PetInput = z.infer<typeof PetInputSchema>

/**
 * Personal Vehicle Type Enum
 */
export const PersonalVehicleTypeSchema = z.enum([
  'car', 'truck', 'suv', 'motorcycle', 'boat_trailer', 'other'
])

/**
 * RV Type Enum
 */
export const RVTypeSchema = z.enum([
  'class_a', 'class_b', 'class_c', 'fifth_wheel',
  'travel_trailer', 'popup', 'truck_camper', 'toy_hauler'
])

/**
 * Vehicle Record Type Enum
 */
export const VehicleRecordTypeSchema = z.enum(['personal', 'rv', 'tow_vehicle'])

/**
 * Vehicle Input Schema
 */
export const VehicleInputSchema = z.object({
  vehicleType: VehicleRecordTypeSchema,
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  licensePlate: z.string().max(20).optional().nullable(),
  licensePlateState: z.string().max(10).optional().nullable(),
  personalVehicleType: PersonalVehicleTypeSchema.optional().nullable(),
  rvType: RVTypeSchema.optional().nullable(),
  rvLengthFeet: z.number().int().min(10).max(60).optional().nullable(),
  rvWidthFeet: z.number().int().min(6).max(12).optional().nullable(),
  numSlideOuts: z.number().int().min(0).max(5).default(0),
  insuranceCompany: z.string().max(200).optional().nullable(),
  insurancePolicyNumber: z.string().max(100).optional().nullable(),
  isPrimary: z.boolean().default(false),
}).refine((data) => {
  // RVs must have rv_type and rv_length_feet
  if (data.vehicleType === 'rv') {
    return data.rvType !== undefined && data.rvType !== null &&
           data.rvLengthFeet !== undefined && data.rvLengthFeet !== null
  }
  return true
}, { message: 'RVs require rvType and rvLengthFeet' })

export type VehicleInput = z.infer<typeof VehicleInputSchema>

/**
 * Evacuation Contact Schema
 */
export const EvacuationContactInputSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  relationship: z.string().max(100).optional().nullable(),
})

export type EvacuationContactInput = z.infer<typeof EvacuationContactInputSchema>

/**
 * Payment Mode for Manual Bookings
 */
export const PaymentModeSchema = z.enum(['cash', 'check', 'card', 'send_link'])

/**
 * Guest Input for Manual Reservation
 */
export const ManualGuestInputSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(1).max(50),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zipCode: z.string().max(20).optional().nullable(),
})

export type ManualGuestInput = z.infer<typeof ManualGuestInputSchema>

/**
 * Create Manual Reservation Request
 * POST /api/v1/properties/[propertyId]/reservations/manual
 *
 * For phone/walk-in bookings with family and vehicle information
 */
export const CreateManualReservationRequestSchema = z.object({
  // Core reservation data
  siteId: z.string().uuid('Site ID must be a valid UUID'),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-in must be YYYY-MM-DD format'),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-out must be YYYY-MM-DD format'),
  stayType: z.enum(['nightly', 'weekly', 'monthly', 'seasonal', 'long_term']).optional(),

  // Occupancy
  numAdults: z.number().int().min(1, 'At least 1 adult required').max(20),
  numChildren: z.number().int().min(0).max(20).optional().default(0),
  numPets: z.number().int().min(0).max(10).optional().default(0),
  numVehicles: z.number().int().min(0).max(5).optional().default(1),

  // Guest information (required)
  guest: ManualGuestInputSchema,

  // Family information (optional)
  spousePartner: SpousePartnerInputSchema.optional().nullable(),
  children: z.array(ChildInputSchema).max(10).optional().default([]),
  pets: z.array(PetInputSchema).max(10).optional().default([]),

  // Vehicle information (optional)
  vehicles: z.array(VehicleInputSchema).max(5).optional().default([]),

  // Emergency contact (optional)
  evacuationContact: EvacuationContactInputSchema.optional().nullable(),

  // Payment
  paymentMode: PaymentModeSchema.default('cash'),
  paymentMethod: PaymentMethodSchema.optional(),
  paidAmountCents: z.number().int().min(0).optional().default(0),
  /** Total reservation amount in cents (from pricing summary). When provided, used as reservation total_amount. */
  totalAmountCents: z.number().int().min(0).optional(),
  paymentNotes: z.string().max(500).optional().nullable(),

  // Discounts and fees
  selectedDiscountIds: z.array(z.string().uuid()).optional().default([]),
  selectedFeeIds: z.array(z.string().uuid()).optional().default([]),

  // Notes
  specialRequests: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export type CreateManualReservationRequest = z.infer<typeof CreateManualReservationRequestSchema>

/**
 * Manual Reservation Response
 */
export const ManualReservationResponseSchema = z.object({
  id: z.string().uuid(),
  confirmationNumber: z.string(),
  guestName: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  totalAmountCents: z.number().int(),
  paidAmountCents: z.number().int(),
  status: ReservationStatusSchema,
  paymentStatus: PaymentStatusSchema,
  childrenCount: z.number().int(),
  vehiclesCount: z.number().int(),
  createdAt: z.string().datetime(),
})

export type ManualReservationResponse = z.infer<typeof ManualReservationResponseSchema>

// ============================================================================
// Payment Link Schemas
// ============================================================================

/**
 * Generate Payment Link Request
 * POST /api/v1/reservations/[id]/payment-link
 */
export const GeneratePaymentLinkRequestSchema = z.object({
  amountCents: z.number().int().min(1).optional(),
  sendEmail: z.boolean().default(false),
})

export type GeneratePaymentLinkRequest = z.infer<typeof GeneratePaymentLinkRequestSchema>

/**
 * Payment Link Response
 */
export const PaymentLinkResponseSchema = z.object({
  url: z.string().url(),
  checkoutSessionId: z.string(),
  amountCents: z.number().int(),
  expiresAt: z.string().datetime(),
})

export type PaymentLinkResponse = z.infer<typeof PaymentLinkResponseSchema>

// ============================================================================
// Phase 3A: Modification, Extension, Renewal, and Refund Schemas
// ============================================================================

/**
 * Modify Reservation Dates Request
 * POST /api/v1/reservations/[id]/modify-dates
 */
export const ModifyReservationDatesRequestSchema = z.object({
  newCheckIn: z.string().datetime('New check-in must be a valid ISO 8601 datetime'),
  newCheckOut: z.string().datetime('New check-out must be a valid ISO 8601 datetime'),
  newTotalAmountCents: z.number().int().min(0, 'Amount cannot be negative'),
})

export type ModifyReservationDatesRequest = z.infer<typeof ModifyReservationDatesRequestSchema>

/**
 * Modify Reservation Guests Request
 * POST /api/v1/reservations/[id]/modify-guests
 */
export const ModifyReservationGuestsRequestSchema = z.object({
  numAdults: z.number().int().min(1, 'At least 1 adult required').max(20),
  numChildren: z.number().int().min(0).max(20),
  numPets: z.number().int().min(0).max(10),
  numVehicles: z.number().int().min(0).max(5),
  newTotalAmountCents: z.number().int().min(0, 'Amount cannot be negative'),
})

export type ModifyReservationGuestsRequest = z.infer<typeof ModifyReservationGuestsRequestSchema>

/**
 * Extend Reservation Request
 * POST /api/v1/reservations/[id]/extend
 */
export const ExtendReservationRequestSchema = z.object({
  newCheckOutDate: z.string().datetime('New check-out must be a valid ISO 8601 datetime'),
  additionalAmountCents: z.number().int().min(0, 'Amount cannot be negative'),
})

export type ExtendReservationRequest = z.infer<typeof ExtendReservationRequestSchema>

/**
 * Renewal Period Schema
 */
export const RenewalPeriodSchema = z.enum(['weekly', 'monthly', 'custom'])

/**
 * Renew Reservation Request
 * POST /api/v1/reservations/[id]/renew
 */
export const RenewReservationRequestSchema = z.object({
  renewalPeriod: RenewalPeriodSchema,
  customNights: z.number().int().min(1).max(365).optional(),
  totalAmountCents: z.number().int().min(0, 'Amount cannot be negative'),
  specialRequests: z.string().max(1000).optional().nullable(),
}).refine(
  (data) => {
    // customNights required when period is 'custom'
    if (data.renewalPeriod === 'custom') {
      return data.customNights !== undefined && data.customNights > 0
    }
    return true
  },
  { message: 'customNights is required when renewalPeriod is "custom"' }
)

export type RenewReservationRequest = z.infer<typeof RenewReservationRequestSchema>

/**
 * Refund Reason Schema
 */
export const RefundReasonSchema = z.enum([
  'cancellation',
  'partial_cancellation',
  'service_issue',
  'overbooking',
  'weather',
  'other',
])

/**
 * Issue Refund Request
 * POST /api/v1/reservations/[id]/refund
 */
export const IssueRefundRequestSchema = z.object({
  amountCents: z.number().int().min(1, 'Refund amount must be positive'),
  reason: RefundReasonSchema,
  notes: z.string().max(1000).optional().nullable(),
})

export type IssueRefundRequest = z.infer<typeof IssueRefundRequestSchema>

/**
 * Renew Reservation Response
 */
export const RenewReservationResponseSchema = z.object({
  originalReservation: ReservationResponseSchema,
  renewalReservation: ReservationResponseSchema,
  renewalNights: z.number().int(),
})

export type RenewReservationResponse = z.infer<typeof RenewReservationResponseSchema>

/**
 * Extend Reservation Response
 */
export const ExtendReservationResponseSchema = z.object({
  reservation: ReservationResponseSchema,
  additionalNights: z.number().int(),
})

export type ExtendReservationResponse = z.infer<typeof ExtendReservationResponseSchema>

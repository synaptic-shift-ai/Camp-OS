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

// ============================================================================
// Vehicle & Family Schemas
// ============================================================================

/**
 * Personal vehicle type enum
 */
export const PersonalVehicleTypeSchema = z.enum([
  'car',
  'truck',
  'suv',
  'motorcycle',
  'boat_trailer',
  'other',
])

/**
 * RV/Camper type enum
 */
export const RVTypeSchema = z.enum([
  'class_a',
  'class_b',
  'class_c',
  'fifth_wheel',
  'travel_trailer',
  'popup',
  'truck_camper',
  'toy_hauler',
])

/**
 * Vehicle record type category
 */
export const VehicleRecordTypeSchema = z.enum(['personal', 'rv', 'tow_vehicle'])

/**
 * US State codes for license plates
 */
export const USStateCodeSchema = z.enum([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
])

/**
 * Schema for creating a guest vehicle
 */
export const CreateVehicleSchema = z.object({
  vehicle_type: VehicleRecordTypeSchema,

  // Personal / Tow vehicle fields
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  color: z.string().max(50).optional(),
  license_plate: z.string().max(20).optional(),
  license_plate_state: z.string().max(10).optional(),
  personal_vehicle_type: PersonalVehicleTypeSchema.optional(),

  // RV/Camper fields
  rv_type: RVTypeSchema.optional(),
  rv_length_feet: z.number().int().min(10).max(60).optional(),
  rv_width_feet: z.number().int().min(6).max(12).optional(),
  num_slide_outs: z.number().int().min(0).max(10).optional(),

  // Compliance fields
  insurance_company: z.string().max(200).optional(),
  insurance_policy_number: z.string().max(100).optional(),

  is_primary: z.boolean().optional().default(false),
}).refine((data) => {
  // If vehicle_type is 'rv', require rv_type and rv_length_feet
  if (data.vehicle_type === 'rv') {
    return data.rv_type !== undefined && data.rv_length_feet !== undefined
  }
  return true
}, {
  message: 'RV type and length are required for RV/camper vehicles',
  path: ['rv_type'],
})

export type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>

/**
 * Schema for creating a child record on reservation
 */
export const CreateChildSchema = z.object({
  first_name: z.string().min(1, 'Child name is required').max(100),
  age: z.number().int().min(0).max(17).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  special_needs_allergies: z.string().max(500).optional(),
}).refine((data) => {
  // Either age or date_of_birth should be provided (at least one)
  return data.age !== undefined || data.date_of_birth !== undefined
}, {
  message: 'Either age or date of birth is required',
  path: ['age'],
})

export type CreateChildInputSchema = z.infer<typeof CreateChildSchema>

/**
 * Schema for spouse/partner information
 */
export const SpousePartnerSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(50).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  is_alternate_contact: z.boolean().default(false),
})

export type SpousePartnerInput = z.infer<typeof SpousePartnerSchema>

/**
 * Schema for evacuation contact
 */
export const EvacuationContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required').max(200),
  phone: z.string().min(10, 'Phone number required').max(50),
  relationship: z.string().max(100).optional(),
})

export type EvacuationContactInput = z.infer<typeof EvacuationContactSchema>

// ============================================================================
// Enhanced Reservation Form Schema (for manual booking with family/vehicles)
// ============================================================================

/**
 * Form schema for manual booking with full guest, vehicle, and payment info
 */
export const ManualBookingFormSchema = z.object({
  // Site selection
  siteId: z.string().min(1, 'Please select a site'),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  stayType: z.enum(['nightly', 'weekly', 'monthly', 'seasonal', 'long_term']).default('nightly'),

  // Occupancy
  numAdults: z.number().min(1, 'At least one adult is required'),
  numChildren: z.number().min(0).default(0),
  numPets: z.number().min(0).default(0),
  numVehicles: z.number().min(0).default(0),

  // Primary guest info
  guestFirstName: z.string().min(1, 'First name is required'),
  guestLastName: z.string().min(1, 'Last name is required'),
  guestEmail: z.string().email('Invalid email address'),
  guestPhone: z.string().min(1, 'Phone number is required'),
  guestAddress: z.string().optional(),
  guestCity: z.string().optional(),
  guestState: z.string().optional(),
  guestZipCode: z.string().optional(),

  // Spouse/Partner (optional)
  hasSpouse: z.boolean().default(false),
  spouse: SpousePartnerSchema.optional(),

  // Children (dynamic array)
  children: z.array(CreateChildSchema).optional(),

  // Vehicles (dynamic array)
  vehicles: z.array(CreateVehicleSchema).optional(),

  // Evacuation contact (optional)
  hasEvacuationContact: z.boolean().default(false),
  evacuationContact: EvacuationContactSchema.optional(),

  // Payment
  paymentMode: z.enum(['cash', 'check', 'card', 'send_link']).default('cash'),
  paymentMethod: z.enum(['credit_card', 'debit_card', 'cash', 'check']).optional(),
  paidAmount: z.string().optional(), // Stored as string for form input, converted to cents
  paymentNotes: z.string().optional(),

  // Manual discounts/fees
  selectedDiscountIds: z.array(z.string()).optional(),
  selectedFeeIds: z.array(z.string()).optional(),

  // Notes
  specialRequests: z.string().optional(),
  notes: z.string().optional(),
})

export type ManualBookingFormData = z.infer<typeof ManualBookingFormSchema>

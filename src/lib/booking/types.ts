/**
 * Booking System Type Definitions
 *
 * These types define the contract between the UI layer and the booking engine.
 * Types match the database schema exactly for type safety.
 * UI-friendly helper types are provided for conversion (e.g., AvailableSite).
 */

// ============================================================================
// Site Types
// ============================================================================

/**
 * Types of campsites available (matches DB CHECK constraint)
 */
export type SiteType = 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'

/**
 * Current operational status of a site (matches DB CHECK constraint)
 * Full lifecycle: available → reserved → booked → occupied → housekeeping → available
 */
export type SiteStatus =
  | 'available'     // Ready for booking
  | 'reserved'      // Reservation placed, pending confirmation
  | 'booked'        // Confirmed reservation, awaiting check-in
  | 'occupied'      // Guest currently staying
  | 'housekeeping'  // Cleaning after checkout
  | 'maintenance'   // Under repair/maintenance
  | 'unavailable'   // Blocked or not usable

/**
 * Amenities that can be associated with a site
 * Used for UI display - DB stores amenities as string[]
 */
export interface SiteAmenities {
  electric?: boolean
  water?: boolean
  sewer?: boolean
  wifi?: boolean
  firepit?: boolean
  picnicTable?: boolean
  petFriendly?: boolean
  pullThrough?: boolean // For RV sites
  [key: string]: boolean | undefined // Allow additional custom amenities
}

/**
 * Complete site information (matches DB sites table)
 */
export interface Site {
  id: string
  property_id: string
  site_number: string
  site_name: string | null // DB allows null
  site_type: SiteType
  max_occupancy: number
  max_vehicles: number
  size_sqft: number | null
  hookups: string[] // JSONB array in DB
  amenities: string[] // JSONB array in DB
  base_price: number // DB column: base_price
  weekend_price: number | null
  status: SiteStatus
  description: string | null
  images: string[] // JSONB array in DB
  location_map: Record<string, any> | null // JSONB object in DB
  allow_pets: boolean // Whether pets are allowed at this site
  pet_fee: number | null // One-time pet fee in cents (NULL if no fee)
  ada_accessible: boolean // ADA accessibility compliance
  accessibility_features: string[] // JSONB array of accessibility features
  imported_at?: string | null // Timestamp when site was imported via CSV bulk upload
  imported_by?: string | null // User ID who performed the CSV bulk import
  created_at: string
  updated_at: string
}

/**
 * UI-friendly site info for availability search results
 * Converts DB schema to UI-friendly names and formats
 */
export interface AvailableSite {
  id: string
  name: string // Derived from site_name || `Site ${site_number}`
  site_number: string
  site_type: SiteType
  max_occupancy: number
  base_price_per_night: number // Converted from base_price
  weekly_rate_cents?: number
  monthly_rate_cents?: number
  amenities: SiteAmenities // Converted from string[]
  image_url?: string // First image from images[]
}

// ============================================================================
// Guest Types
// ============================================================================

/**
 * Guest information for reservation (matches DB guests table)
 */
export interface Guest {
  id: string
  property_id: string
  user_id: string | null // Link to authenticated user if exists
  first_name: string
  last_name: string
  email: string
  phone: string | null // DB allows null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  stripe_customer_id: string | null // Stripe Customer ID for saved payment methods
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * Minimal guest info needed for new booking
 */
export interface CreateGuestInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
}

// ============================================================================
// Reservation Types
// ============================================================================

/**
 * Lifecycle status of a reservation (matches DB CHECK constraint)
 */
export type ReservationStatus =
  | 'pending'      // Payment not yet completed
  | 'confirmed'    // Payment successful, reservation active
  | 'checked_in'   // Guest has checked in
  | 'checked_out'  // Guest has checked out
  | 'cancelled'    // Reservation cancelled
  | 'no_show'      // Guest did not arrive

/**
 * Site condition assessment during check-out inspection
 */
export type SiteCondition = 'excellent' | 'good' | 'fair' | 'poor'

/**
 * Equipment status assessment during check-out inspection
 */
export type EquipmentStatus = 'all_present' | 'missing_items' | 'damaged'

/**
 * Cleanliness assessment during check-out inspection
 */
export type CleanlinessLevel = 'clean' | 'needs_cleaning' | 'excessive_mess'

/**
 * Structured damage inspection data collected during check-out
 */
export interface DamageInspectionData {
  site_condition: SiteCondition
  equipment_status: EquipmentStatus
  cleanliness: CleanlinessLevel
  damage_description?: string
  estimated_repair_cost?: number // In cents
  inspected_at: string // ISO 8601 timestamp
  photos?: string[] // URLs to uploaded photos
}

/**
 * Payment status for reservation (matches DB CHECK constraint)
 */
export type ReservationPaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded'

/**
 * Complete reservation record (matches DB reservations table)
 */
export interface Reservation {
  id: string
  property_id: string
  site_id: string
  guest_id: string
  confirmation_number: string
  check_in_date: string // ISO 8601 date string
  check_out_date: string // ISO 8601 date string
  num_adults: number
  num_children: number
  num_pets: number
  num_vehicles: number
  vehicle_info: Array<Record<string, any>> // JSONB array in DB
  total_amount: number
  paid_amount: number
  status: ReservationStatus
  payment_status: ReservationPaymentStatus
  special_requests: string | null
  source: string // 'online', 'phone', 'walkin', etc.
  notes: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string

  // Check-in workflow fields
  checked_in_at: string | null // ISO 8601 timestamp when guest checked in
  checked_in_by: string | null // User ID of staff who performed check-in
  balance_paid_at_checkin: number | null // Additional payment collected at check-in (in cents)
  check_in_notes: string | null // Staff notes from check-in process

  // Check-out workflow fields
  checked_out_at: string | null // ISO 8601 timestamp when guest checked out
  checked_out_by: string | null // User ID of staff who performed check-out
  damage_inspection_data: DamageInspectionData | null // Structured damage inspection results
  check_out_notes: string | null // Staff notes from check-out process

  // Joined data (when queried with relations)
  site?: Site
  guest?: Guest
  payments?: Payment[] // Can have multiple payments
}

/**
 * Input for creating a new reservation
 */
export interface CreateReservationInput {
  property_id: string
  site_id: string
  guest: CreateGuestInput | { guest_id: string } // Either new guest or existing guest ID
  check_in_date: string // YYYY-MM-DD format
  check_out_date: string // YYYY-MM-DD format
  num_adults: number
  num_children?: number
  num_pets?: number
  num_vehicles?: number
  vehicle_info?: Array<Record<string, any>>
  special_requests?: string
  source?: string
  booking_type?: BookingType // Type of booking (nightly, weekly, monthly, seasonal, long_term)
  booking_period?: BookingPeriod // Additional metadata for seasonal/monthly bookings

  // Family information (enhanced booking form)
  spouse_partner?: SpousePartnerInput
  children?: CreateChildInputData[]
  pets?: CreatePetInputData[]

  // Vehicle information (enhanced booking form)
  vehicles?: CreateVehicleInputData[]

  // Emergency evacuation contact
  evacuation_contact?: EvacuationContactInput

  // Manual discount/fee selections
  selected_discount_ids?: string[]
  selected_fee_ids?: string[]

  // Payment mode for admin bookings
  payment_mode?: 'cash' | 'check' | 'card' | 'send_link'
}

/**
 * Spouse/Partner information for guest profile
 */
export interface SpousePartnerInput {
  first_name: string
  last_name: string
  phone?: string
  email?: string
  is_alternate_contact: boolean
}

/**
 * Child information for reservation
 */
export interface CreateChildInputData {
  first_name: string
  age?: number
  date_of_birth?: string // YYYY-MM-DD format
  special_needs_allergies?: string
}

/**
 * Pet information for reservation
 */
export interface CreatePetInputData {
  name: string
  type: 'dog' | 'cat' | 'bird' | 'other'
  breed?: string
  weight_lbs?: number
  notes?: string
}

/**
 * Vehicle information for guest profile
 */
export interface CreateVehicleInputData {
  vehicle_type: 'personal' | 'rv' | 'tow_vehicle'
  make?: string
  model?: string
  year?: number
  color?: string
  license_plate?: string
  license_plate_state?: string
  personal_vehicle_type?: 'car' | 'truck' | 'suv' | 'motorcycle' | 'boat_trailer' | 'other'
  rv_type?: 'class_a' | 'class_b' | 'class_c' | 'fifth_wheel' | 'travel_trailer' | 'popup' | 'truck_camper' | 'toy_hauler'
  rv_length_feet?: number
  rv_width_feet?: number
  num_slide_outs?: number
  insurance_company?: string
  insurance_policy_number?: string
  is_primary?: boolean
}

/**
 * Evacuation contact for emergency scenarios
 */
export interface EvacuationContactInput {
  name: string
  phone: string
  relationship?: string
}

// ============================================================================
// Payment Types
// ============================================================================

/**
 * Payment status (matches DB CHECK constraint)
 */
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

/**
 * Payment method (matches DB CHECK constraint)
 */
export type PaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'check'
  | 'bank_transfer'
  | 'other'

/**
 * Payment record (matches DB payments table)
 */
export interface Payment {
  id: string
  property_id: string
  reservation_id: string
  amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  stripe_payment_id: string | null // Renamed from stripe_payment_intent_id
  processed_at: string | null // When payment was processed
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Pricing Types
// ============================================================================

/**
 * Detailed breakdown of reservation pricing
 */
export interface PriceBreakdown {
  // Base pricing
  base_price_per_night?: number
  basePrice?: number
  number_of_nights?: number
  nights?: number
  subtotal: number // base_price_per_night × number_of_nights (before fees and discounts)

  // Rate information
  rate_type?: 'standard' | 'weekend' | 'nightly' | 'weekly' | 'monthly' | 'seasonal' // Which rate was applied
  /** Display label for base rate, e.g. "1 week ($200) + 1 night ($30/night)" */
  base_price_label?: string
  discount_applied?: {
    type: 'weekly' | 'monthly'
    percentage: number
    amount_saved: number // In cents
  }

  // Seasonal pricing info
  seasonal_pricing_applied?: boolean
  seasonal_rate?: number // If seasonal pricing was used

  // User-defined fees (new system)
  user_fees?: Array<{
    id: string
    title: string
    amount: number // In cents
    is_taxable: boolean
  }>

  // User-defined discounts (new system)
  user_discounts?: Array<{
    id: string
    title: string
    amount: number // In cents (positive number, subtracted from total)
    trigger_type: 'manual' | 'min_nights' | 'min_guests' | 'date_range'
  }>

  // Legacy fees (in cents) - kept for backward compatibility
  cleaning_fee?: number
  cleaningFee?: number
  pet_fee?: number
  petFee?: number
  extra_guest_fee?: number
  extraGuestFee?: number
  extra_guest_count?: number // Number of guests beyond threshold
  weekend_surcharge?: number
  weekendSurcharge?: number
  weekend_nights?: number // Number of weekend nights
  service_fee?: number
  serviceFee?: number

  // Taxes
  tax_rate?: number
  taxRate?: number
  taxes?: number
  tax_name?: string // Display name (e.g., "Sales Tax", "Occupancy Tax")

  // Deposit
  deposit_required?: boolean
  deposit_amount?: number
  deposit_percentage?: number
  deposit_due_date?: string // ISO date string

  // Totals
  total_before_tax?: number // Subtotal + fees (before tax)
  total: number // Final amount including everything

  // Payment breakdown
  amount_due_now?: number // Deposit or full amount
  amount_due_later?: number // Remaining balance after deposit
}

// ============================================================================
// Search/Filter Types
// ============================================================================

/**
 * Parameters for searching available sites
 */
export interface AvailabilitySearchParams {
  property_id: string
  check_in_date: string // YYYY-MM-DD
  check_out_date: string // YYYY-MM-DD
  num_adults?: number
  num_children?: number
  num_pets?: number
  site_type?: SiteType
  amenities?: string[] // Match against DB amenities array
  /** Filter by reservation type (nightly, weekly, monthly, seasonal) */
  reservation_type?: 'nightly' | 'weekly' | 'monthly' | 'seasonal'
  /**
   * Guest search: when true, weekly/monthly amounts from site_type_config are only used if the
   * property also has weekly/monthly enabled in Rate Types. Prevents public UI from showing
   * weekly/monthly breakdown when the campground only sells nightly at the property level.
   */
  respect_property_enabled_rate_types?: boolean
}

/**
 * Result of availability search
 */
export interface AvailabilitySearchResult {
  sites: AvailableSite[]
  check_in_date: string
  check_out_date: string
  total_nights: number
  /** Auto-detected best reservation type based on stay length */
  suggested_reservation_type?: 'nightly' | 'weekly' | 'monthly' | 'seasonal'
  /** Explanation for why this type was suggested */
  suggested_type_reason?: string
  /** Reservation types available at this property */
  available_reservation_types?: ('nightly' | 'weekly' | 'monthly' | 'seasonal')[]
}

// ============================================================================
// Checkout Context Types
// ============================================================================

/**
 * Data stored in checkout context during booking flow
 */
export interface CheckoutData {
  // Property context
  propertyId?: string
  propertyName?: string
  cancellationPolicy?: string | null
  /** Guest-visible payment methods enabled for this property */
  enabledPaymentMethods?: Array<'card' | 'amazon_pay' | 'cashapp'>

  // Site selection
  site?: AvailableSite
  checkInDate?: Date
  checkOutDate?: Date

  // Guest info
  guestInfo?: CreateGuestInput

  // Additional details
  numAdults?: number
  numChildren?: number
  numPets?: number
  numVehicles?: number
  vehicleInfo?: Array<Record<string, any>>
  specialRequests?: string

  // Pricing
  priceBreakdown?: PriceBreakdown

  // Payment
  stripePaymentIntentId?: string
  paymentProcessor?: 'stripe' | 'campost_payments' | 'none'

  // Confirmation
  confirmationNumber?: string
  reservationId?: string
  reservedUntil?: string // Checkout timer expiration (ISO timestamp)
}

// ============================================================================
// Validation Error Types
// ============================================================================

/**
 * Error response from booking operations
 */
export interface BookingError {
  code: string
  message: string
  field?: string // Which field caused the error
}

/**
 * Result type for operations that may fail
 */
export type BookingResult<T> =
  | { success: true; data: T }
  | { success: false; error: BookingError }

// ============================================================================
// Constants
// ============================================================================

/**
 * Default tax rate for bookings (8.5%)
 */
export const DEFAULT_TAX_RATE = 0.085

// ============================================================================
// Booking Lifecycle Types (Extensions, Renewals, Modifications)
// ============================================================================

/**
 * Type of booking (matches DB CHECK constraint)
 */
export type BookingType = 'nightly' | 'weekly' | 'monthly' | 'seasonal' | 'long_term'

/**
 * Renewal status for seasonal/monthly bookings
 */
export type RenewalStatus = 'n/a' | 'eligible' | 'offered' | 'accepted' | 'declined' | 'expired'

/**
 * Type of action performed on a reservation
 */
export type ReservationActionType =
  | 'created'
  | 'extended'
  | 'renewed'
  | 'modified'
  | 'cancelled'
  | 'rebooked'
  | 'site_changed'
  | 'type_converted'

/**
 * Booking period metadata for seasonal/monthly reservations
 */
export interface BookingPeriod {
  season: string          // "Summer 2025", "Winter 2024-2025", "Q1 2025"
  start_date: string      // ISO date: "2025-05-01"
  end_date: string        // ISO date: "2025-10-31"
  description?: string    // Optional additional context
}

/**
 * Property-level renewal configuration
 */
export interface RenewalSettings {
  seasonal_renewal_window_days: number    // Days before season end to offer renewal (default: 30)
  monthly_renewal_window_days: number     // Days before month end (default: 7)
  renewal_deposit_percentage: number      // Percentage of total for deposit (default: 25)
  auto_release_on_decline: boolean        // Release site if guest declines (default: true)
  send_renewal_reminders: boolean         // Automated email reminders (default: true)
  reminder_days_before: number[]          // Days before deadline to send reminders (default: [7, 14, 21])
}

/**
 * Extended reservation with lifecycle fields
 */
export interface ReservationWithLifecycle extends Reservation {
  // Booking type and period
  booking_type: BookingType
  booking_period: BookingPeriod | null

  // Relationship tracking
  parent_reservation_id: string | null    // Previous period if renewal
  is_extension_of: string | null          // Original reservation if split

  // Original immutable dates
  original_check_in: string
  original_check_out: string

  // Modification counters
  times_extended: number
  times_modified: number

  // Renewal workflow
  renewal_status: RenewalStatus
  renewal_offered_at: string | null
  renewal_deadline: string | null
  renewal_notes: string | null
}

/**
 * Audit record for reservation actions
 */
export interface ReservationAction {
  id: string
  reservation_id: string
  action_type: ReservationActionType
  action_details: Record<string, any>

  // Who and when
  performed_by: string | null
  performed_at: string

  // Financial impact
  price_change_cents: number
  payment_id: string | null

  // State snapshots
  previous_state: Record<string, any> | null
  new_state: Record<string, any> | null

  notes: string | null
  created_at: string
}

/**
 * Extension action details
 */
export interface ExtensionDetails {
  nights_added: number
  original_checkout: string
  new_checkout: string
  direction: 'before' | 'after'
  original_checkin?: string
  new_checkin?: string
}

/**
 * Renewal action details
 */
export interface RenewalDetails {
  renewal_type: 'seasonal' | 'monthly' | 'weekly'
  next_reservation_id: string
  season?: string
  deposit_paid: number
  next_period: BookingPeriod
}

/**
 * Modification action details
 */
export interface ModificationDetails {
  changes: {
    check_in_date?: { from: string; to: string }
    check_out_date?: { from: string; to: string }
    site_id?: { from: string; to: string }
    num_adults?: { from: number; to: number }
    num_children?: { from: number; to: number }
  }
}

/**
 * Payment installment for multi-step payments
 */
export interface PaymentInstallment {
  id: string
  reservation_id: string
  installment_number: number
  description: string
  amount_cents: number
  due_date: string              // ISO date
  status: 'pending' | 'paid' | 'overdue' | 'waived' | 'cancelled'
  payment_id: string | null
  notes: string | null
  reminder_sent_at: string[]    // Array of ISO timestamps
  created_at: string
  updated_at: string
}

// ============================================================================
// Availability Checking Types
// ============================================================================

/**
 * Availability status result
 */
export type AvailabilityStatus = 'fully_available' | 'partially_available' | 'not_available'

/**
 * Conflict with existing reservation
 */
export interface ReservationConflict {
  type: 'existing_reservation' | 'pending_renewal' | 'maintenance' | 'site_unavailable'
  reservation?: {
    id: string
    confirmation_number: string
    guest_name: string
    check_in: string
    check_out: string
    status: ReservationStatus
    payment_status: ReservationPaymentStatus
    booking_type: BookingType
  }
  conflicting_dates: {
    start: string
    end: string
  }
  message?: string
}

/**
 * Alternative site suggestion
 */
export interface AlternativeSite {
  site_id: string
  site_number: string
  site_name: string | null
  site_type: SiteType
  available_through: string
  price_per_night: number
  similarity_score: number      // 0-100, how similar to requested site
  amenities: string[]
}

/**
 * Action recommendation from availability check
 */
export interface ActionRecommendation {
  action: 'extend_full' | 'extend_partial' | 'move_site' | 'renew_same_site' | 'renew_different_site' | 'manual_review'
  description: string
  price_change?: number
  new_site_id?: string
  requires_approval?: boolean
}

/**
 * Date range
 */
export interface DateRange {
  start: string
  end: string
}

/**
 * Availability check result
 */
export interface ActionAvailabilityCheck {
  available: boolean
  status: AvailabilityStatus
  conflicts: ReservationConflict[]
  available_range?: DateRange
  alternatives: AlternativeSite[]
  recommendations: ActionRecommendation[]
  checked_at: string
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to check action availability
 */
export interface CheckActionRequest {
  action: 'extend' | 'renew'
  params: {
    // For extend
    newCheckOut?: string | undefined
    newCheckIn?: string | undefined
    extendBefore?: number | undefined     // nights
    extendAfter?: number | undefined      // nights

    // For renew
    nextPeriodStart?: string | undefined
    nextPeriodEnd?: string | undefined
    nextPeriod?: BookingPeriod | undefined
  }
}

/**
 * Request to process reservation action
 */
export interface ProcessActionRequest {
  action: 'extend' | 'renew' | 'modify' | 'change_site' | 'convert_type' | 'offer_renewal' | 'decline_renewal'
  params: {
    // For extend
    newCheckOut?: string | undefined
    newCheckIn?: string | undefined
    selectedDiscountIds?: string[] | undefined

    // For renew
    nextPeriod?: BookingPeriod | undefined
    renewalDeadline?: string | undefined
    depositAmount?: number | undefined

    // For modify
    changes?: ModificationDetails['changes'] | undefined

    // Common
    sendEmail?: boolean | undefined
    notes?: string | undefined
  }
}

/**
 * Response from processing action
 */
export interface ProcessActionResponse {
  success: boolean
  reservation?: ReservationWithLifecycle
  action?: ReservationAction
  price_change?: number
  payment_required?: boolean
  next_steps?: string[]
  error?: BookingError
}

/**
 * Create seasonal reservation input
 */
export interface CreateSeasonalReservationInput {
  property_id: string
  site_id: string
  guest: CreateGuestInput | { guest_id: string }
  booking_type: 'seasonal' | 'monthly' | 'long_term'
  booking_period: BookingPeriod
  check_in_date: string
  check_out_date: string
  total_amount: number
  payment_schedule: Array<{
    description: string
    amount: number
    due_date: string
  }>
  num_adults: number
  num_children?: number
  num_pets?: number
  num_vehicles?: number
  vehicle_info?: Array<Record<string, any>>
  special_requests?: string
  notes?: string
}

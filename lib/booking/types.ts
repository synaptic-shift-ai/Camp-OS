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
 */
export type SiteStatus = 'available' | 'unavailable' | 'maintenance'

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
  allow_pets: boolean
  pet_fee: number | null
  ada_accessible: boolean
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
 * Payment status for reservation (matches DB CHECK constraint)
 */
export type ReservationPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'

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
  base_price_per_night: number
  number_of_nights: number
  subtotal: number // base_price_per_night × number_of_nights

  // Additional fees
  cleaning_fee?: number
  pet_fee?: number
  extra_guest_fee?: number
  weekend_surcharge?: number

  total: number
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
}

/**
 * Result of availability search
 */
export interface AvailabilitySearchResult {
  sites: AvailableSite[]
  check_in_date: string
  check_out_date: string
  total_nights: number
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

  // Confirmation
  confirmationNumber?: string
  reservationId?: string
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

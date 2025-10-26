/**
 * Booking System Type Definitions
 *
 * These types define the contract between the UI layer and the booking engine.
 * Use these when building UI components with v0 or manually.
 */

// ============================================================================
// Site Types
// ============================================================================

/**
 * Types of campsites available
 */
export type SiteType = 'rv' | 'tent' | 'cabin' | 'glamping'

/**
 * Current operational status of a site
 */
export type SiteStatus = 'available' | 'occupied' | 'maintenance' | 'unavailable'

/**
 * Amenities that can be associated with a site
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
 * Complete site information
 */
export interface Site {
  id: string
  property_id: string
  name: string
  site_number: string
  site_type: SiteType
  status: SiteStatus
  max_occupancy: number
  base_price_per_night: number
  amenities: SiteAmenities
  description?: string
  image_url?: string
  created_at: string
  updated_at: string
}

/**
 * Simplified site info for availability search results
 */
export interface AvailableSite {
  id: string
  name: string
  site_number: string
  site_type: SiteType
  max_occupancy: number
  base_price_per_night: number
  amenities: SiteAmenities
  image_url?: string
}

// ============================================================================
// Guest Types
// ============================================================================

/**
 * Guest information for reservation
 */
export interface Guest {
  id: string
  property_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  notes?: string
  created_at: string
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
}

// ============================================================================
// Reservation Types
// ============================================================================

/**
 * Lifecycle status of a reservation
 */
export type ReservationStatus =
  | 'pending'      // Payment not yet completed
  | 'confirmed'    // Payment successful, reservation active
  | 'checked_in'   // Guest has checked in
  | 'checked_out'  // Guest has checked out
  | 'cancelled'    // Reservation cancelled

/**
 * Complete reservation record
 */
export interface Reservation {
  id: string
  property_id: string
  site_id: string
  guest_id: string
  confirmation_number: string
  check_in_date: string // ISO 8601 date string
  check_out_date: string // ISO 8601 date string
  number_of_guests: number
  total_amount: number
  status: ReservationStatus
  special_requests?: string
  created_at: string
  updated_at: string

  // Joined data (when queried with relations)
  site?: Site
  guest?: Guest
  payment?: Payment
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
  number_of_guests: number
  special_requests?: string
}

// ============================================================================
// Payment Types
// ============================================================================

/**
 * Payment status
 */
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

/**
 * Payment method
 */
export type PaymentMethod = 'card' | 'cash' | 'check' | 'other'

/**
 * Payment record
 */
export interface Payment {
  id: string
  property_id: string
  reservation_id: string
  amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  stripe_payment_intent_id?: string
  transaction_date: string
  notes?: string
  created_at: string
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

  // Future fees (not implemented in Phase 1A)
  cleaning_fee?: number
  pet_fee?: number
  extra_guest_fee?: number

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
  number_of_guests?: number
  site_type?: SiteType
  amenities?: Partial<SiteAmenities> // Filter by required amenities
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

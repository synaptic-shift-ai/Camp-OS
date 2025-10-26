/**
 * Booking Domain Contracts
 *
 * Application DTOs for the booking domain.
 * These types are the canonical interface between UI and business logic.
 *
 * RULES:
 * - All types here are UI-facing (camelCase, clean shapes)
 * - DB types come from db.ts (generated)
 * - Adapters in src/compat/ handle conversion
 */

// ============================================================================
// Enums (match DB CHECK constraints)
// ============================================================================

export type SiteType = 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'

export type SiteStatus = 'available' | 'unavailable' | 'maintenance'

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show'

export type ReservationPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export type PaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'check'
  | 'bank_transfer'
  | 'other'

// ============================================================================
// Money Type (Phase 2c Complete: Now using integer cents)
// ============================================================================

/**
 * Money amount in integer cents (BIGINT in database)
 *
 * Phase 2c Migration Complete:
 * - All money fields stored as BIGINT in database
 * - All calculations done in integer cents
 * - Stripe integration uses cents directly
 *
 * @example
 * const price: MoneyCents = 4599 // $45.99
 * const free: MoneyCents = 0     // $0.00
 */
declare const MoneyCentsBrand: unique symbol
export type MoneyCents = number & { readonly [MoneyCentsBrand]: typeof MoneyCentsBrand }

/**
 * @deprecated Use MoneyCents instead. This alias maintained for backward compatibility.
 * Will be removed in Phase 3.
 */
export type MoneyAmount = MoneyCents

// ============================================================================
// DTOs - UI-facing shapes
// ============================================================================

/**
 * Site availability search result
 * Clean shape for UI consumption
 */
export interface AvailableSiteDTO {
  id: string
  name: string
  siteNumber: string
  siteType: SiteType
  maxOccupancy: number
  basePricePerNight: MoneyAmount
  amenities: string[]
  imageUrl?: string
}

/**
 * Price breakdown for reservation
 */
export interface PriceBreakdownDTO {
  basePricePerNight: MoneyAmount
  numberOfNights: number
  subtotal: MoneyAmount
  cleaningFee?: MoneyAmount
  petFee?: MoneyAmount
  extraGuestFee?: MoneyAmount
  weekendSurcharge?: MoneyAmount
  total: MoneyAmount
}

/**
 * Guest information input
 */
export interface CreateGuestDTO {
  firstName: string
  lastName: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
}

/**
 * Reservation creation input
 */
export interface CreateReservationDTO {
  propertyId: string
  siteId: string
  checkInDate: string // YYYY-MM-DD
  checkOutDate: string // YYYY-MM-DD
  numAdults: number
  numChildren?: number
  numPets?: number
  numVehicles?: number
  guest: CreateGuestDTO
  specialRequests?: string
}

/**
 * Reservation detail (full)
 */
export interface ReservationDTO {
  id: string
  propertyId: string
  siteId: string
  guestId: string
  confirmationNumber: string
  checkInDate: string
  checkOutDate: string
  numAdults: number
  numChildren: number
  numPets: number
  numVehicles: number
  status: ReservationStatus
  paymentStatus: ReservationPaymentStatus
  totalAmount: MoneyAmount
  paidAmount: MoneyAmount
  specialRequests?: string
  createdAt: string
  updatedAt: string
}

/**
 * Payment record
 */
export interface PaymentDTO {
  id: string
  reservationId: string
  amount: MoneyAmount
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  stripePaymentId?: string
  processedAt?: string
  createdAt: string
}

// ============================================================================
// Result Type for Service Layer
// ============================================================================

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

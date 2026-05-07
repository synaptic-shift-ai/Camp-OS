/**
 * Booking Engine - Main Export
 *
 * Import from this file in your components:
 * import { searchAvailableSites, type AvailableSite } from '@/lib/booking'
 */

// Export all types
export type {
  // Sites
  SiteType,
  SiteStatus,
  SiteAmenities,
  Site,
  AvailableSite,
  // Guests
  Guest,
  CreateGuestInput,
  // Reservations
  ReservationStatus,
  Reservation,
  CreateReservationInput,
  // Payments
  PaymentStatus,
  PaymentMethod,
  Payment,
  // Pricing
  PriceBreakdown,
  // Search
  AvailabilitySearchParams,
  AvailabilitySearchResult,
  // Errors
  BookingError,
  BookingResult,
} from './types'

// Export all API functions
export type { CheckSiteAvailabilityOptions } from './availability'

export {
  // Availability
  searchAvailableSites,
  checkSiteAvailability,
  // Pricing
  calculateReservationPrice,
  // Reservations
  createReservation,
  getReservationByConfirmation,
  // TODO: Implement getPropertyReservations for operator dashboard
  // getPropertyReservations,
  // Helpers
  generateConfirmationNumber,
  validateDateRange,
} from './api'

/**
 * Booking Engine API
 *
 * This file contains all the business logic for the booking system.
 * UI components should import and call these functions.
 */

// Re-export availability functions from availability module
export { checkSiteAvailability, searchAvailableSites } from './availability'

// Re-export pricing functions from pricing module
export { calculateReservationPrice } from './pricing'

// Re-export guest management functions from guest module
export { createOrGetGuest, getGuestById, getGuestByEmail } from './guest'

// Re-export reservation functions from reservation module
export {
  createReservation,
  getReservationById,
  getReservationByConfirmation,
  confirmReservationPayment,
} from './reservation'

// Re-export site query functions from sites module
export { getSiteById, getSimilarSites } from './sites'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate number of nights between check-in and check-out
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Generate unique confirmation number
 * Format: CAMP-YYYY-XXXXXX
 */
export function generateConfirmationNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `CAMP-${year}-${random}`
}

/**
 * Validate date range for booking
 */
export function validateDateRange(checkIn: string, checkOut: string): BookingResult<void> {
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (start < today) {
    return {
      success: false,
      error: {
        code: 'INVALID_DATE_RANGE',
        message: 'Check-in date cannot be in the past',
        field: 'check_in_date',
      },
    }
  }

  if (end <= start) {
    return {
      success: false,
      error: {
        code: 'INVALID_DATE_RANGE',
        message: 'Check-out date must be after check-in date',
        field: 'check_out_date',
      },
    }
  }

  return { success: true, data: undefined }
}

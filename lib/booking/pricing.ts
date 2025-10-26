/**
 * Pricing Calculation Functions
 *
 * Handles reservation pricing with support for:
 * - Base pricing
 * - Weekend pricing differentials
 * - Pet fees
 * - Additional fees (future: cleaning, extra guests)
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateDateRange } from './api'
import type { Site, PriceBreakdown, BookingResult } from './types'

/**
 * Calculate number of nights between check-in and check-out
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const diffTime = end.getTime() - start.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if a date falls on Friday or Saturday (weekend nights)
 * @param date - Date string in YYYY-MM-DD format
 * @returns true if Friday (5) or Saturday (6)
 */
function isWeekendNight(date: string): boolean {
  const d = new Date(date + 'T00:00:00')
  const dayOfWeek = d.getDay()
  return dayOfWeek === 5 || dayOfWeek === 6 // Friday or Saturday
}

/**
 * Count weekend nights in a date range
 * Weekend nights are Friday and Saturday
 */
function countWeekendNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  let weekendNights = 0

  // Iterate through each night
  const current = new Date(start)
  while (current < end) {
    if (isWeekendNight(current.toISOString().split('T')[0])) {
      weekendNights++
    }
    current.setDate(current.getDate() + 1)
  }

  return weekendNights
}

/**
 * Calculate total price for a reservation
 *
 * Pricing rules:
 * 1. Base price applies to all weekday nights (Sun-Thu)
 * 2. Weekend price (if set) applies to Friday and Saturday nights
 * 3. Pet fee (if applicable) is added once per stay
 * 4. Future: cleaning fees, extra guest fees
 *
 * @param siteId - Site being booked
 * @param checkInDate - Check-in date (YYYY-MM-DD)
 * @param checkOutDate - Check-out date (YYYY-MM-DD)
 * @param options - Optional parameters (num_pets, etc.)
 * @returns Detailed price breakdown
 */
export async function calculateReservationPrice(
  siteId: string,
  checkInDate: string,
  checkOutDate: string,
  options?: {
    num_pets?: number
    num_adults?: number
    num_children?: number
  }
): Promise<BookingResult<PriceBreakdown>> {
  const supabase = createServiceRoleClient()

  // Validate date range
  const dateValidation = validateDateRange(checkInDate, checkOutDate)
  if (!dateValidation.success) {
    return dateValidation as BookingResult<PriceBreakdown>
  }

  // Fetch site to get pricing
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .single()

  if (siteError || !site) {
    return {
      success: false,
      error: {
        code: 'SITE_NOT_FOUND',
        message: 'Site not found',
      },
    }
  }

  const typedSite = site as Site

  // Calculate nights
  const totalNights = calculateNights(checkInDate, checkOutDate)

  // Calculate weekend nights and weekday nights
  const weekendNights = countWeekendNights(checkInDate, checkOutDate)
  const weekdayNights = totalNights - weekendNights

  // Calculate base pricing
  const basePrice = typedSite.base_price
  const weekendPrice = typedSite.weekend_price || basePrice

  // Calculate subtotal
  const weekdaySubtotal = weekdayNights * basePrice
  const weekendSubtotal = weekendNights * weekendPrice
  const subtotal = weekdaySubtotal + weekendSubtotal

  // Build price breakdown
  const breakdown: PriceBreakdown = {
    base_price_per_night: basePrice,
    number_of_nights: totalNights,
    subtotal,
    total: subtotal,
  }

  // Add weekend surcharge if applicable
  if (weekendNights > 0 && typedSite.weekend_price && typedSite.weekend_price > basePrice) {
    const weekendSurcharge = weekendNights * (weekendPrice - basePrice)
    breakdown.weekend_surcharge = weekendSurcharge
  }

  // Add pet fee if applicable
  const numPets = options?.num_pets || 0
  if (numPets > 0 && typedSite.allow_pets && typedSite.pet_fee) {
    breakdown.pet_fee = typedSite.pet_fee
    breakdown.total += typedSite.pet_fee
  }

  // Future: Add other fees (cleaning, extra guests, etc.)

  return {
    success: true,
    data: breakdown,
  }
}

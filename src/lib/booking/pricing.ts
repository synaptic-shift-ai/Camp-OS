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
import type { Site, PriceBreakdown, BookingResult, SiteType } from './types'

/**
 * Simple synchronous price calculation for guest bookings
 * Used when we already have the site data and just need to calculate totals
 */
export function calculatePriceBreakdown(params: {
  basePricePerNight: number
  numberOfNights: number
  siteType: SiteType
  numPets?: number | undefined
  petFeeCentsOverride?: number | undefined
}): PriceBreakdown {
  const { basePricePerNight, numberOfNights, numPets, petFeeCentsOverride } = params

  const subtotal = basePricePerNight * numberOfNights
  const total = subtotal

  const breakdown: PriceBreakdown = {
    base_price_per_night: basePricePerNight,
    number_of_nights: numberOfNights,
    subtotal,
    total,
  }

  // Add pet fee if applicable (flat $20 per stay for simplicity)
  if (numPets && numPets > 0) {
    const petFee = petFeeCentsOverride ?? 2000 // default $20.00 in cents
    breakdown.pet_fee = petFee
    breakdown.total += petFee
  }

  return breakdown
}

/**
 * Base subtotal in cents for N nights using weekly/monthly rules (matches PricingSummary).
 * Use for extension pricing and any place that needs "total for N nights" without fees/discounts.
 */
export function calculateBaseSubtotalCents(
  nights: number,
  basePriceCents: number,
  weeklyRateCents: number | null | undefined,
  monthlyRateCents: number | null | undefined
): number {
  if (nights >= 28 && monthlyRateCents != null && monthlyRateCents > 0) {
    const fullMonths = Math.floor(nights / 28)
    const remainder = nights % 28
    return fullMonths * monthlyRateCents + remainder * basePriceCents
  }
  if (nights >= 7 && weeklyRateCents != null && weeklyRateCents > 0) {
    const weeklyCents = weeklyRateCents
    const fullWeeks = Math.floor(nights / 7)
    const remainder = nights % 7
    return fullWeeks * weeklyCents + remainder * basePriceCents
  }
  return nights * basePriceCents
}

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`

/**
 * Base subtotal and display label for Booking Summary (matches Pricing Summary).
 * For 7+ nights uses weekly rate; for 28+ nights uses monthly rate when available.
 */
export function getBaseSubtotalAndLabel(
  nights: number,
  basePriceCents: number,
  weeklyRateCents: number | null | undefined,
  monthlyRateCents: number | null | undefined
): { subtotalCents: number; basePriceLabel: string; rateType: 'nightly' | 'weekly' | 'monthly' } {
  if (nights >= 28 && monthlyRateCents != null && monthlyRateCents > 0) {
    const fullMonths = Math.floor(nights / 28)
    const remainder = nights % 28
    const subtotalCents = fullMonths * monthlyRateCents + remainder * basePriceCents
    const basePriceLabel =
      remainder === 0
        ? `${fullMonths} month${fullMonths !== 1 ? 's' : ''} (${formatMoney(monthlyRateCents)}/month)`
        : `${fullMonths} month${fullMonths !== 1 ? 's' : ''} (${formatMoney(monthlyRateCents)}) + ${remainder} night${remainder !== 1 ? 's' : ''} (${formatMoney(basePriceCents)}/night)`
    return { subtotalCents, basePriceLabel, rateType: 'monthly' }
  }
  if (nights >= 7 && weeklyRateCents != null && weeklyRateCents > 0) {
    const weeklyCents = weeklyRateCents
    const fullWeeks = Math.floor(nights / 7)
    const remainder = nights % 7
    const subtotalCents = fullWeeks * weeklyCents + remainder * basePriceCents
    const basePriceLabel =
      remainder === 0
        ? `${fullWeeks} week${fullWeeks !== 1 ? 's' : ''} (${formatMoney(weeklyCents)}/week)`
        : `${fullWeeks} week${fullWeeks !== 1 ? 's' : ''} (${formatMoney(weeklyCents)}) + ${remainder} night${remainder !== 1 ? 's' : ''} (${formatMoney(basePriceCents)}/night)`
    return { subtotalCents, basePriceLabel, rateType: 'weekly' }
  }
  const subtotalCents = nights * basePriceCents
  const basePriceLabel = `${formatMoney(basePriceCents)}/night × ${nights} night${nights !== 1 ? 's' : ''}`
  return { subtotalCents, basePriceLabel, rateType: 'nightly' }
}

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
    if (isWeekendNight(current.toISOString().split('T')[0]!)) {
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
    .is('deleted_at', null)
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

/**
 * Enhanced Pricing Calculation Engine
 *
 * Comprehensive pricing system with support for:
 * - Property-level configuration with site-level overrides
 * - Seasonal pricing (templates + per-site)
 * - Weekly/monthly discounts
 * - Tax and service fees
 * - Deposits with flexible rules
 * - Extra guest fees
 * - Cleaning fees
 * - Pet fees
 *
 * @module lib/booking/pricing-enhanced
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateDateRange } from './api'
import type { PriceBreakdown, BookingResult, BookingType } from './types'
import type {
  PropertyWithConfig,
  SiteWithConfig,
  SeasonalPricingEntry,
  SeasonalPricingTemplate,
} from '@/lib/config/types'
import {
  resolvePricingConfig,
  resolveDepositConfig,
  resolveRateDiscountsConfig,
  getEffectiveNightlyRate,
  getApplicableDiscountTier,
} from '@/lib/config/resolution'

// =====================================================
// Helper Functions
// =====================================================

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
 */
function isWeekendNight(date: string): boolean {
  const d = new Date(date + 'T00:00:00')
  const dayOfWeek = d.getDay()
  return dayOfWeek === 5 || dayOfWeek === 6
}

/**
 * Count weekend nights in a date range
 */
function countWeekendNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  let weekendNights = 0

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
 * Get the day of week for a date string
 */
function getDayOfWeek(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[d.getDay()]!
}

/**
 * Check if a date falls within a seasonal pricing period
 */
function isDateInSeasonalPeriod(
  date: string,
  season: SeasonalPricingEntry,
  isWeekend: boolean
): boolean {
  const dateObj = new Date(date)
  const startObj = new Date(season.start_date)
  const endObj = new Date(season.end_date)

  // Check if date is in range
  if (dateObj < startObj || dateObj > endObj) {
    return false
  }

  // If seasonal pricing only applies to weekends, check that too
  if (season.applies_to_weekends && !isWeekend) {
    return false
  }

  return true
}

/**
 * Get seasonal price for a specific date
 */
function getSeasonalPrice(
  date: string,
  seasonalPricing: SeasonalPricingEntry[],
  isWeekend: boolean
): number | null {
  // Find matching seasonal pricing (last match wins if multiple)
  for (let i = seasonalPricing.length - 1; i >= 0; i--) {
    const season = seasonalPricing[i]!
    if (isDateInSeasonalPeriod(date, season, isWeekend)) {
      return season.price_cents
    }
  }
  return null
}

// =====================================================
// Main Pricing Calculation
// =====================================================

export interface CalculatePriceOptions {
  num_pets?: number
  num_adults?: number
  num_children?: number
  booking_type?: BookingType
  paid_in_full?: boolean // Guest paying full amount upfront
}

/**
 * Calculate comprehensive reservation price with all fees, taxes, and deposits
 *
 * This is the main pricing function that incorporates all configuration:
 * - Seasonal pricing (templates + per-site)
 * - Weekly/monthly discounts
 * - Property + site level pricing configuration
 * - Taxes and service fees
 * - Deposits with flexible rules
 * - Extra guest fees
 * - Cleaning fees
 * - Pet fees
 *
 * @param siteId - Site being booked
 * @param checkInDate - Check-in date (YYYY-MM-DD)
 * @param checkOutDate - Check-out date (YYYY-MM-DD)
 * @param options - Optional parameters (pets, guests, booking type, etc.)
 * @returns Detailed price breakdown with all fees and deposits
 */
export async function calculateReservationPriceEnhanced(
  siteId: string,
  checkInDate: string,
  checkOutDate: string,
  options: CalculatePriceOptions = {}
): Promise<BookingResult<PriceBreakdown>> {
  const supabase = createServiceRoleClient()

  // Validate date range
  const dateValidation = validateDateRange(checkInDate, checkOutDate)
  if (!dateValidation.success) {
    return dateValidation as BookingResult<PriceBreakdown>
  }

  // Fetch site with all configuration fields
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select(`
      *,
      property:properties (
        *
      )
    `)
    .eq('id', siteId)
    .single()

  if (siteError || !site || !site.property) {
    return {
      success: false,
      error: {
        code: 'SITE_NOT_FOUND',
        message: 'Site not found or property not configured',
      },
    }
  }

  const typedSite = site as unknown as SiteWithConfig & { property: PropertyWithConfig }
  const property = typedSite.property

  // Resolve effective configurations
  const pricingConfig = resolvePricingConfig(
    property.pricing_config,
    typedSite.pricing_override
  ).config

  const depositConfig = resolveDepositConfig(
    property.deposit_config,
    typedSite.deposit_override
  ).config

  const rateDiscountsConfig = resolveRateDiscountsConfig(property.rate_discounts_config)

  // Calculate nights
  const totalNights = calculateNights(checkInDate, checkOutDate)
  const weekendNights = countWeekendNights(checkInDate, checkOutDate)
  const weekdayNights = totalNights - weekendNights

  // Determine applicable discount tier
  const discountTier = getApplicableDiscountTier(rateDiscountsConfig, totalNights)

  // Calculate base pricing with seasonal pricing support
  let subtotal = 0
  let baseRateUsed = typedSite.base_price
  let rateType: 'standard' | 'weekend' | 'weekly' | 'monthly' | 'seasonal' = 'standard'
  let seasonalPricingApplied = false
  let weekendSurcharge = 0

  // Check if we have seasonal pricing to apply
  const seasonalPricing = (typedSite.seasonal_pricing as SeasonalPricingEntry[]) || []

  // Calculate price for each night
  const current = new Date(checkInDate + 'T00:00:00')
  const end = new Date(checkOutDate + 'T00:00:00')

  while (current < end) {
    const dateStr = current.toISOString().split('T')[0]!
    const isWeekend = isWeekendNight(dateStr)

    // Check for seasonal pricing first
    const seasonalPrice = getSeasonalPrice(dateStr, seasonalPricing, isWeekend)

    if (seasonalPrice) {
      // Use seasonal price for this night
      subtotal += seasonalPrice
      seasonalPricingApplied = true
      rateType = 'seasonal'
    } else {
      // Use standard pricing logic with weekly/monthly discounts
      const effectiveRate = getEffectiveNightlyRate(
        typedSite,
        rateDiscountsConfig,
        totalNights,
        isWeekend
      )

      subtotal += effectiveRate

      // Track weekend surcharge for display
      if (isWeekend && typedSite.weekend_price_cents && typedSite.weekend_price_cents > typedSite.base_price) {
        weekendSurcharge += (typedSite.weekend_price_cents - typedSite.base_price)
      }

      // Update rate type based on what was applied
      if (discountTier.tier === 'monthly') {
        rateType = 'monthly'
      } else if (discountTier.tier === 'weekly') {
        rateType = 'weekly'
      } else if (isWeekend && typedSite.weekend_price_cents) {
        rateType = 'weekend'
      }

      baseRateUsed = effectiveRate
    }

    current.setDate(current.getDate() + 1)
  }

  // Build initial price breakdown
  const breakdown: PriceBreakdown = {
    base_price_per_night: baseRateUsed,
    number_of_nights: totalNights,
    subtotal,
    total: subtotal,
    rate_type: rateType,
  }

  // Add weekend information if applicable
  if (weekendNights > 0) {
    breakdown.weekend_nights = weekendNights
    if (weekendSurcharge > 0 && !seasonalPricingApplied) {
      breakdown.weekend_surcharge = weekendSurcharge
    }
  }

  // Add seasonal pricing info
  if (seasonalPricingApplied) {
    breakdown.seasonal_pricing_applied = true
  }

  // Add discount information if applicable
  if (discountTier.tier !== 'none' && !seasonalPricingApplied) {
    const regularSubtotal = typedSite.base_price * totalNights
    const discountAmount = regularSubtotal - subtotal

    breakdown.discount_applied = {
      type: discountTier.tier,
      percentage: discountTier.discount_percentage,
      amount_saved: discountAmount,
    }
  }

  // ===== ADD FEES =====

  // Cleaning fee
  const cleaningFee = typedSite.pricing_override?.default_cleaning_fee_cents
    ?? pricingConfig.default_cleaning_fee_cents
  if (cleaningFee && cleaningFee > 0) {
    breakdown.cleaning_fee = cleaningFee
    breakdown.total += cleaningFee
  }

  // Pet fee
  const numPets = options.num_pets || 0
  if (numPets > 0 && typedSite.allow_pets) {
    const petFee = typedSite.pet_fee ?? pricingConfig.pet_fee_cents
    if (petFee && petFee > 0) {
      breakdown.pet_fee = petFee
      breakdown.total += petFee
    }
  }

  // Extra guest fee
  if (pricingConfig.extra_guest_fee_enabled) {
    const totalGuests = (options.num_adults || 1) + (options.num_children || 0)
    const extraGuests = Math.max(0, totalGuests - pricingConfig.extra_guest_threshold)

    if (extraGuests > 0 && pricingConfig.extra_guest_fee_cents > 0) {
      const extraGuestFee = extraGuests * pricingConfig.extra_guest_fee_cents * totalNights
      breakdown.extra_guest_fee = extraGuestFee
      breakdown.extra_guest_count = extraGuests
      breakdown.total += extraGuestFee
    }
  }

  // Service fee
  if (pricingConfig.service_fee_type !== 'none') {
    let serviceFee = 0

    switch (pricingConfig.service_fee_type) {
      case 'percentage':
        serviceFee = Math.round((breakdown.total * (pricingConfig.service_fee_percentage || 0)) / 100)
        break
      case 'flat':
        serviceFee = pricingConfig.service_fee_amount_cents ?? 0
        break
      case 'per_night':
        serviceFee = (pricingConfig.service_fee_amount_cents ?? 0) * totalNights
        break
    }

    if (serviceFee > 0) {
      breakdown.service_fee = serviceFee
      breakdown.total += serviceFee
    }
  }

  // Store total before tax
  breakdown.total_before_tax = breakdown.total

  // ===== ADD TAXES =====

  if (pricingConfig.tax_rate > 0) {
    const taxes = Math.round(breakdown.total_before_tax * pricingConfig.tax_rate)
    breakdown.taxes = taxes
    breakdown.tax_rate = pricingConfig.tax_rate
    if (pricingConfig.tax_name) {
      breakdown.tax_name = pricingConfig.tax_name
    }
    breakdown.total += taxes
  }

  // ===== CALCULATE DEPOSIT =====

  const bookingType = options.booking_type || 'nightly'
  const paidInFull = options.paid_in_full || false

  // Check if deposit is required
  const depositRequired =
    depositConfig.require_deposit &&
    depositConfig.applies_to_booking_types.includes(bookingType) &&
    !(depositConfig.exempt_if_paid_in_full && paidInFull)

  if (depositRequired) {
    let depositAmount = 0

    switch (depositConfig.deposit_type) {
      case 'percentage':
        depositAmount = Math.round(
          (breakdown.total * (depositConfig.deposit_percentage || 0)) / 100
        )
        break
      case 'flat_amount':
        depositAmount = depositConfig.deposit_amount_cents || 0
        break
      case 'first_night':
        depositAmount = baseRateUsed
        break
    }

    breakdown.deposit_required = true
    breakdown.deposit_amount = depositAmount
    if (depositConfig.deposit_percentage !== undefined) {
      breakdown.deposit_percentage = depositConfig.deposit_percentage
    }

    // Calculate payment breakdown
    breakdown.amount_due_now = depositAmount
    breakdown.amount_due_later = breakdown.total - depositAmount

    // Calculate deposit due date if configured
    if (depositConfig.full_payment_required_days_before) {
      const checkInDateObj = new Date(checkInDate)
      const depositDueDate = new Date(checkInDateObj)
      depositDueDate.setDate(depositDueDate.getDate() - depositConfig.full_payment_required_days_before)
      const dueDateStr = depositDueDate.toISOString().split('T')[0]
      if (dueDateStr) {
        breakdown.deposit_due_date = dueDateStr
      }
    }
  } else {
    // No deposit required - full payment due
    breakdown.deposit_required = false
    breakdown.amount_due_now = breakdown.total
    breakdown.amount_due_later = 0
  }

  return {
    success: true,
    data: breakdown,
  }
}

// =====================================================
// Legacy Compatibility Function
// =====================================================

/**
 * Legacy pricing function for backward compatibility
 * Wraps the enhanced pricing engine
 *
 * @deprecated Use calculateReservationPriceEnhanced instead
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
  return calculateReservationPriceEnhanced(siteId, checkInDate, checkOutDate, options)
}

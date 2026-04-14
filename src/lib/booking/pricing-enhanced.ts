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
import { calculateBaseSubtotalCents } from './pricing'
import type { PriceBreakdown, BookingResult, BookingType } from './types'
import type {
  PropertyWithConfig,
  SiteWithConfig,
  SeasonalPricingEntry,
} from '@/lib/config/types'
import {
  resolvePricingConfig,
  resolveDepositConfig,
  resolveRateDiscountsConfig,
  resolveReservationTypeRate,
  resolveReservationTypesConfig,
  getEffectiveNightlyRate,
  getApplicableDiscountTier,
} from '@/lib/config/resolution'
import { getPricingSourceType } from '@/lib/site-pricing-source'
import type { PropertyReservationTypesConfig } from '@/lib/config/types'

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
  for_extension?: boolean
  /** When set, manual discounts with these IDs are applied (e.g. extend flow, admin booking) */
  selected_discount_ids?: string[]
  /**
   * For extension: subtotal (cents) of the additional nights only.
   * When set, percentage discounts are applied to this amount instead of the full period subtotal.
   */
  extension_additional_subtotal_cents?: number
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
    .is('deleted_at', null)
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

  // Resolve reservation type configuration (for per-type pricing)
  const reservationTypesConfig = resolveReservationTypesConfig(
    property.reservation_type_config as PropertyReservationTypesConfig | null
  )

  // When site does not use manual pricing (property_default or site_type_default),
  // use property's reservation_type_config rates for base, weekly, and monthly pricing
  const usesPropertyDefaults =
    getPricingSourceType((typedSite as { pricing_override?: unknown }).pricing_override, (typedSite as { enabled_reservation_types_override?: unknown }).enabled_reservation_types_override) !== 'manual'
  const propertyNightlyCents = reservationTypesConfig?.nightly?.rate_cents ?? null
  const propertyWeeklyCents = reservationTypesConfig?.weekly?.rate_cents ?? null
  const propertyMonthlyCents = reservationTypesConfig?.monthly?.rate_cents ?? null
  // When using property defaults, do not apply site-level weekend_price (property config has no weekend rate)
  const siteForRates =
    usesPropertyDefaults && propertyNightlyCents != null
      ? {
          ...typedSite,
          base_price: propertyNightlyCents,
          weekly_rate_cents: propertyWeeklyCents ?? typedSite.weekly_rate_cents ?? null,
          monthly_rate_cents: propertyMonthlyCents ?? typedSite.monthly_rate_cents ?? null,
          weekend_price: null,
        }
      : typedSite

  // Calculate nights
  const totalNights = calculateNights(checkInDate, checkOutDate)
  const weekendNights = countWeekendNights(checkInDate, checkOutDate)
  const _weekdayNights = totalNights - weekendNights

  // Determine booking type - use explicit type if provided, otherwise detect
  const effectiveBookingType = options.booking_type || 'nightly'
  const usePerTypePricing = effectiveBookingType !== 'nightly' && options.booking_type !== undefined

  // Resolve per-type rate if applicable
  const perTypeRate = usePerTypePricing
    ? resolveReservationTypeRate(
        effectiveBookingType,
        reservationTypesConfig,
        typedSite.reservation_type_rates_override as Partial<Record<BookingType, number>> | null,
        {
          base_price: typedSite.base_price,
          weekly_rate_cents: typedSite.weekly_rate_cents ?? null,
          monthly_rate_cents: typedSite.monthly_rate_cents ?? null,
        }
      )
    : null

  // Determine applicable discount tier (for non-per-type pricing)
  const discountTier = getApplicableDiscountTier(rateDiscountsConfig, totalNights)

  // Calculate base pricing with seasonal pricing support
  let subtotal = 0
  let baseRateUsed = perTypeRate ?? typedSite.base_price
  let rateType: 'standard' | 'weekend' | 'weekly' | 'monthly' | 'seasonal' = 'standard'
  let seasonalPricingApplied = false
  let weekendSurcharge = 0

  // Set initial rate type based on booking type
  if (usePerTypePricing) {
    rateType = effectiveBookingType as 'weekly' | 'monthly' | 'seasonal'
  }

  // Check if we have seasonal pricing to apply
  const seasonalPricing = (typedSite.seasonal_pricing as SeasonalPricingEntry[]) || []

  // Calculate price: use block-based weekly/monthly for standard path to avoid charging weekly rate per night
  const current = new Date(checkInDate + 'T00:00:00')
  const end = new Date(checkOutDate + 'T00:00:00')

  while (current < end) {
    const dateStr = current.toISOString().split('T')[0]!
    const isWeekend = isWeekendNight(dateStr)

    // Check for seasonal pricing first (overrides per-type pricing)
    const seasonalPrice = getSeasonalPrice(dateStr, seasonalPricing, isWeekend)

    if (seasonalPrice) {
      // Use seasonal price for this night
      subtotal += seasonalPrice
      seasonalPricingApplied = true
      rateType = 'seasonal'
    } else if (usePerTypePricing && perTypeRate !== null) {
      // Use per-type flat rate for this night
      subtotal += perTypeRate
    } else {
      // Standard path: will be replaced by block subtotal below; this branch only runs for first night to set rateType
      const effectiveRate = getEffectiveNightlyRate(
        siteForRates,
        rateDiscountsConfig,
        totalNights,
        isWeekend
      )
      if (discountTier.tier === 'monthly') {
        rateType = 'monthly'
      } else if (discountTier.tier === 'weekly') {
        rateType = 'weekly'
      } else if (isWeekend && typedSite.weekend_price) {
        rateType = 'weekend'
      }
      baseRateUsed = effectiveRate
    }

    current.setDate(current.getDate() + 1)
  }

  // Standard (non-seasonal, non-per-type) path: use block-based subtotal so weekly = 1×weekly_rate + remainder×base, not 8×weekly_rate
  if (!seasonalPricingApplied && !(usePerTypePricing && perTypeRate !== null)) {
    subtotal = calculateBaseSubtotalCents(
      totalNights,
      siteForRates.base_price,
      siteForRates.weekly_rate_cents ?? null,
      siteForRates.monthly_rate_cents ?? null
    )
    if (totalNights >= 28 && siteForRates.monthly_rate_cents) {
      baseRateUsed = siteForRates.monthly_rate_cents
    } else if (totalNights >= 7 && siteForRates.weekly_rate_cents) {
      baseRateUsed = siteForRates.weekly_rate_cents
    } else {
      baseRateUsed = siteForRates.base_price
    }
    // Weekend surcharge only for remainder nights (charged at base_price)
    const fullWeeks = totalNights >= 7 ? Math.floor(totalNights / 7) : 0
    const remainderCount = totalNights >= 28 ? totalNights % 28 : totalNights >= 7 ? totalNights % 7 : totalNights
    const remainderStartNightIndex = totalNights - remainderCount
    let nightIdx = 0
    const surchargeStart = new Date(checkInDate + 'T00:00:00')
    const surchargeEnd = new Date(checkOutDate + 'T00:00:00')
    const cursor = new Date(surchargeStart)
    while (cursor < surchargeEnd) {
      if (nightIdx >= remainderStartNightIndex) {
        const dateStr = cursor.toISOString().split('T')[0]!
        if (isWeekendNight(dateStr) && siteForRates.weekend_price != null && siteForRates.weekend_price > siteForRates.base_price) {
          weekendSurcharge += siteForRates.weekend_price - siteForRates.base_price
        }
      }
      nightIdx++
      cursor.setDate(cursor.getDate() + 1)
    }
    subtotal += weekendSurcharge
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

  // Add legacy discount information only when we used per-night legacy percentage (not block pricing with custom weekly/monthly)
  const usedBlockPricing =
    !seasonalPricingApplied && !(usePerTypePricing && perTypeRate !== null)
  if (
    discountTier.tier !== 'none' &&
    !seasonalPricingApplied &&
    !usedBlockPricing
  ) {
    const regularSubtotal = siteForRates.base_price * totalNights
    const discountAmount = regularSubtotal - subtotal

    breakdown.discount_applied = {
      type: discountTier.tier,
      percentage: discountTier.discount_percentage,
      amount_saved: discountAmount,
    }
  }

  // ===== ADD FEES =====
  const totalGuests = (options.num_adults || 1) + (options.num_children || 0)
  const numPets = options.num_pets || 0

    // Check if we have user-defined fees (new system)
    const userDefinedFees = pricingConfig.user_defined_fees || []

    if (userDefinedFees.length > 0) {
      // Use new user-defined fees system (match Pricing Summary: only apply when trigger conditions are met)
      breakdown.user_fees = []
      let _taxableFeesTotal = 0

      for (const fee of userDefinedFees) {
        if (!fee.enabled) continue

        const triggerType = fee.trigger_type || 'always'
        let shouldApplyFee = false
        switch (triggerType) {
          case 'always':
            shouldApplyFee = true
            break
          case 'manual':
            shouldApplyFee = false
            break
          case 'min_nights':
            shouldApplyFee = totalNights >= (fee.trigger_conditions?.min_nights ?? 0)
            break
          case 'min_guests':
            shouldApplyFee = totalGuests >= (fee.trigger_conditions?.min_guests ?? 0)
            break
          case 'has_pets':
            shouldApplyFee = numPets > 0
            break
          case 'date_range':
            if (fee.trigger_conditions?.start_date != null || fee.trigger_conditions?.end_date != null) {
              const check = new Date(checkInDate)
              const start = fee.trigger_conditions?.start_date ? new Date(fee.trigger_conditions.start_date) : null
              const end = fee.trigger_conditions?.end_date ? new Date(fee.trigger_conditions.end_date) : null
              shouldApplyFee = (!start || check >= start) && (!end || check <= end)
            } else {
              shouldApplyFee = true
            }
            break
          default:
            shouldApplyFee = true
        }

        if (!shouldApplyFee) continue

        let feeAmount = 0

        switch (fee.fee_type) {
          case 'flat_amount':
            feeAmount = fee.value_cents ?? 0
            break
          case 'percentage_of_subtotal':
            feeAmount = Math.round(breakdown.subtotal * (fee.value_percentage ?? 0) / 100)
            break
          case 'percentage_of_total':
            feeAmount = Math.round(breakdown.total * (fee.value_percentage ?? 0) / 100)
            break
          case 'per_night':
            feeAmount = (fee.value_cents ?? 0) * totalNights
            break
          case 'per_guest':
            feeAmount = (fee.value_cents ?? 0) * totalGuests
            break
          case 'per_guest_per_night':
            feeAmount = (fee.value_cents ?? 0) * totalGuests * totalNights
            break
        }

        if (feeAmount > 0) {
          breakdown.user_fees.push({
            id: fee.id,
            title: fee.title,
            amount: feeAmount,
            is_taxable: fee.is_taxable,
          })
          breakdown.total += feeAmount

          if (fee.is_taxable) {
            _taxableFeesTotal += feeAmount
          }
        }
      }
    } else {
      // LEGACY: Use old hard-coded fees system for backward compatibility

      // Cleaning fee
      const cleaningFee = typedSite.pricing_override?.default_cleaning_fee_cents
        ?? pricingConfig.default_cleaning_fee_cents
      if (cleaningFee && cleaningFee > 0) {
        breakdown.cleaning_fee = cleaningFee
        breakdown.total += cleaningFee
      }

      // Pet fee
      if (numPets > 0 && typedSite.allow_pets) {
        const petFee = typedSite.pet_fee ?? pricingConfig.pet_fee_cents
        if (petFee && petFee > 0) {
          breakdown.pet_fee = petFee
          breakdown.total += petFee
        }
      }

      // Extra guest fee
      if (pricingConfig.extra_guest_fee_enabled) {
        const extraGuestThreshold = pricingConfig.extra_guest_threshold ?? 2
        const extraGuests = Math.max(0, totalGuests - extraGuestThreshold)
        const extraGuestFeeCents = pricingConfig.extra_guest_fee_cents ?? 0

        if (extraGuests > 0 && extraGuestFeeCents > 0) {
          const extraGuestFee = extraGuests * extraGuestFeeCents * totalNights
          breakdown.extra_guest_fee = extraGuestFee
          breakdown.extra_guest_count = extraGuests
          breakdown.total += extraGuestFee
        }
      }

      // Service fee
      if (pricingConfig.service_fee_type && pricingConfig.service_fee_type !== 'none') {
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
    }

  // ===== APPLY USER-DEFINED DISCOUNTS (auto-triggered + manual when selected) =====
  const userDefinedDiscounts = rateDiscountsConfig.user_defined_discounts || []
  const selectedDiscountIds = options.selected_discount_ids ?? []

  // For extension: only apply discounts that are explicitly selected (no auto-apply).
  // So staff chooses exactly which discounts apply; additional charge = (new total with selected discounts) - (original total).
  const extensionMode = options.for_extension === true

  if (userDefinedDiscounts.length > 0) {
    if (!breakdown.user_discounts) breakdown.user_discounts = []

    for (const discount of userDefinedDiscounts) {
      if (!discount.enabled) continue

      let shouldApply: boolean
      if (extensionMode) {
        shouldApply = selectedDiscountIds.includes(discount.id)
      } else if (discount.trigger_type === 'manual') {
        shouldApply = selectedDiscountIds.includes(discount.id)
      } else {
        switch (discount.trigger_type) {
          case 'min_nights':
            shouldApply = totalNights >= (discount.trigger_conditions?.min_nights ?? 0)
            break
          case 'min_guests':
            shouldApply = totalGuests >= (discount.trigger_conditions?.min_guests ?? 0)
            break
          case 'date_range':
            if (discount.trigger_conditions?.start_date && discount.trigger_conditions?.end_date) {
              const checkInStr = checkInDate.slice(0, 10)
              const startStr = String(discount.trigger_conditions.start_date).slice(0, 10)
              const endStr = String(discount.trigger_conditions.end_date).slice(0, 10)
              shouldApply = checkInStr >= startStr && checkInStr <= endStr
            } else {
              shouldApply = false
            }
            break
          default:
            shouldApply = false
        }
      }

      if (!shouldApply) continue

      // For extension: percentage discounts apply only to the additional nights' subtotal
      const discountBaseCents =
        extensionMode && options.extension_additional_subtotal_cents != null
          ? options.extension_additional_subtotal_cents
          : breakdown.subtotal

      let discountAmount = 0

      switch (discount.discount_type) {
        case 'flat_amount':
          discountAmount = discount.value_cents ?? 0
          break
        case 'percentage_of_subtotal':
          discountAmount = Math.round(discountBaseCents * (discount.value_percentage ?? 0) / 100)
          break
        case 'percentage_of_total':
          discountAmount = Math.round(discountBaseCents * (discount.value_percentage ?? 0) / 100)
          break
      }

      // Apply max discount cap if set
      if (discount.max_discount_cents && discountAmount > discount.max_discount_cents) {
        discountAmount = discount.max_discount_cents
      }

      if (discountAmount > 0) {
        breakdown.user_discounts.push({
          id: discount.id,
          title: discount.title,
          amount: discountAmount,
          trigger_type: discount.trigger_type,
        })
        breakdown.total -= discountAmount
      }
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

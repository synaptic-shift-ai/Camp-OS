/**
 * Booking Rules Validation Engine
 *
 * Validates booking requests against property and site-level rules:
 * - Minimum/maximum stay requirements
 * - Booking window restrictions
 * - Advance notice requirements
 * - Check-in/out day restrictions
 * - Blackout dates
 * - Same-day booking rules
 *
 * @module lib/booking/validation
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { BookingResult } from './types'
import type {
  PropertyWithConfig,
  SiteWithConfig,
  BookingRuleValidationResult,
  BookingRuleValidationError,
} from '@/lib/config/types'
import { resolveBookingRulesConfig } from '@/lib/config/resolution'

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
 * Get the day of week for a date string
 */
function getDayOfWeek(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[d.getDay()]!
}

/**
 * Calculate days from now until a future date
 */
function daysUntilDate(date: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(date + 'T00:00:00')
  const diffTime = target.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if a date is today
 */
function isToday(date: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const check = new Date(date + 'T00:00:00')
  return check.getTime() === today.getTime()
}

/**
 * Calculate days from now until a date is N days in the future
 */
function daysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]!
}

// =====================================================
// Validation Functions
// =====================================================

/**
 * Validate minimum stay requirement
 */
function validateMinStay(
  numNights: number,
  minStayNights: number,
  _checkInDate: string
): BookingRuleValidationError | null {
  if (numNights < minStayNights) {
    return {
      code: 'MIN_STAY_NOT_MET',
      message: `This site requires a minimum stay of ${minStayNights} night${minStayNights > 1 ? 's' : ''}. Your stay is ${numNights} night${numNights > 1 ? 's' : ''}.`,
      field: 'check_out_date',
      rule_violated: 'min_stay_nights',
      rule_value: minStayNights,
    }
  }
  return null
}

/**
 * Validate maximum stay requirement
 */
function validateMaxStay(
  numNights: number,
  maxStayNights: number | null
): BookingRuleValidationError | null {
  if (maxStayNights && numNights > maxStayNights) {
    return {
      code: 'MAX_STAY_EXCEEDED',
      message: `This site allows a maximum stay of ${maxStayNights} night${maxStayNights > 1 ? 's' : ''}. Your stay is ${numNights} night${numNights > 1 ? 's' : ''}.`,
      field: 'check_out_date',
      rule_violated: 'max_stay_nights',
      rule_value: maxStayNights,
    }
  }
  return null
}

/**
 * Validate booking window (how far in advance bookings are accepted)
 */
function validateBookingWindow(
  checkInDate: string,
  bookingWindowDays: number
): BookingRuleValidationError | null {
  const daysUntil = daysUntilDate(checkInDate)

  if (daysUntil > bookingWindowDays) {
    const maxDate = daysFromNow(bookingWindowDays)
    return {
      code: 'BOOKING_WINDOW_EXCEEDED',
      message: `Bookings can only be made up to ${bookingWindowDays} days in advance. The earliest available check-in date is ${maxDate}.`,
      field: 'check_in_date',
      rule_violated: 'booking_window_days',
      rule_value: bookingWindowDays,
    }
  }
  return null
}

/**
 * Validate advance notice requirement
 */
function validateAdvanceNotice(
  checkInDate: string,
  advanceNoticeDays: number,
  sameDayBookingEnabled: boolean
): BookingRuleValidationError | null {
  const daysUntil = daysUntilDate(checkInDate)

  // Special case: same-day booking
  if (isToday(checkInDate)) {
    if (!sameDayBookingEnabled) {
      return {
        code: 'SAME_DAY_BOOKING_NOT_ALLOWED',
        message: 'Same-day bookings are not permitted. Please select a check-in date at least 1 day in the future.',
        field: 'check_in_date',
        rule_violated: 'same_day_booking_enabled',
        rule_value: false,
      }
    }
    return null
  }

  // Check advance notice for future dates
  if (daysUntil < advanceNoticeDays) {
    return {
      code: 'ADVANCE_NOTICE_NOT_MET',
      message: `Bookings must be made at least ${advanceNoticeDays} day${advanceNoticeDays > 1 ? 's' : ''} in advance. Please select a check-in date on or after ${daysFromNow(advanceNoticeDays)}.`,
      field: 'check_in_date',
      rule_violated: 'advance_notice_days',
      rule_value: advanceNoticeDays,
    }
  }

  return null
}

/**
 * Validate check-in day restrictions
 */
function validateCheckInDay(
  checkInDate: string,
  allowedCheckInDays: string[]
): BookingRuleValidationError | null {
  const dayOfWeek = getDayOfWeek(checkInDate)

  if (!allowedCheckInDays.includes(dayOfWeek)) {
    const allowedDaysFormatted = allowedCheckInDays
      .map(d => d.charAt(0).toUpperCase() + d.slice(1))
      .join(', ')

    return {
      code: 'CHECKIN_DAY_NOT_ALLOWED',
      message: `Check-in is only allowed on: ${allowedDaysFormatted}. ${checkInDate} is a ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}.`,
      field: 'check_in_date',
      rule_violated: 'allowed_checkin_days',
      rule_value: allowedCheckInDays,
    }
  }

  return null
}

/**
 * Validate check-out day restrictions
 */
function validateCheckOutDay(
  checkOutDate: string,
  allowedCheckOutDays: string[]
): BookingRuleValidationError | null {
  const dayOfWeek = getDayOfWeek(checkOutDate)

  if (!allowedCheckOutDays.includes(dayOfWeek)) {
    const allowedDaysFormatted = allowedCheckOutDays
      .map(d => d.charAt(0).toUpperCase() + d.slice(1))
      .join(', ')

    return {
      code: 'CHECKOUT_DAY_NOT_ALLOWED',
      message: `Check-out is only allowed on: ${allowedDaysFormatted}. ${checkOutDate} is a ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}.`,
      field: 'check_out_date',
      rule_violated: 'allowed_checkout_days',
      rule_value: allowedCheckOutDays,
    }
  }

  return null
}

/**
 * Validate blackout dates (no check-in allowed)
 */
function validateBlackoutDates(
  checkInDate: string,
  blackoutDates: string[]
): BookingRuleValidationError | null {
  if (blackoutDates.includes(checkInDate)) {
    return {
      code: 'BLACKOUT_DATE',
      message: `Check-in is not allowed on ${checkInDate} due to property restrictions. Please select a different date.`,
      field: 'check_in_date',
      rule_violated: 'blackout_dates',
      rule_value: blackoutDates,
    }
  }

  return null
}

// =====================================================
// Main Validation Function
// =====================================================

export interface ValidateBookingRulesOptions {
  /** Property ID (used to fetch configuration if property not provided) */
  property_id?: string
  /** Pre-fetched property with configuration */
  property?: PropertyWithConfig
  /** Site ID (used to fetch configuration if site not provided) */
  site_id?: string
  /** Pre-fetched site with configuration */
  site?: SiteWithConfig
}

/**
 * Validate a booking request against all applicable rules
 *
 * Checks property-level and site-level booking rules with proper override logic.
 * Returns detailed validation errors for any rule violations.
 *
 * @param checkInDate - Check-in date (YYYY-MM-DD)
 * @param checkOutDate - Check-out date (YYYY-MM-DD)
 * @param options - Site/property data or IDs to fetch
 * @returns Validation result with detailed errors if any rules violated
 */
export async function validateBookingRules(
  checkInDate: string,
  checkOutDate: string,
  options: ValidateBookingRulesOptions
): Promise<BookingResult<BookingRuleValidationResult>> {
  const supabase = createServiceRoleClient()

  // Fetch site and property if not provided
  let site: SiteWithConfig | undefined = options.site
  let property: PropertyWithConfig | undefined = options.property

  if (!site && options.site_id) {
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', options.site_id)
      .single()

    if (siteError || !siteData) {
      return {
        success: false,
        error: {
          code: 'SITE_NOT_FOUND',
          message: 'Site not found',
        },
      }
    }

    site = siteData as unknown as SiteWithConfig
  }

  if (!property && (options.property_id || site?.property_id)) {
    const propertyId = options.property_id || site!.property_id
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single()

    if (propertyError || !propertyData) {
      return {
        success: false,
        error: {
          code: 'PROPERTY_NOT_FOUND',
          message: 'Property not found',
        },
      }
    }

    property = propertyData as unknown as PropertyWithConfig
  }

  if (!property) {
    return {
      success: false,
      error: {
        code: 'MISSING_CONFIGURATION',
        message: 'Property or property_id required for validation',
      },
    }
  }

  // Resolve effective booking rules (property + site overrides)
  const effectiveRules = resolveBookingRulesConfig(
    property.booking_rules_config,
    site?.booking_rules_override,
    site?.availability_rules
  ).config

  // Calculate nights
  const numNights = calculateNights(checkInDate, checkOutDate)

  // Run all validations
  const errors: BookingRuleValidationError[] = []

  // 1. Minimum stay
  const minStayError = validateMinStay(numNights, effectiveRules.min_stay_nights, checkInDate)
  if (minStayError) errors.push(minStayError)

  // 2. Maximum stay
  const maxStayError = validateMaxStay(numNights, effectiveRules.max_stay_nights)
  if (maxStayError) errors.push(maxStayError)

  // 3. Booking window
  const bookingWindowError = validateBookingWindow(checkInDate, effectiveRules.booking_window_days)
  if (bookingWindowError) errors.push(bookingWindowError)

  // 4. Advance notice
  const advanceNoticeError = validateAdvanceNotice(
    checkInDate,
    effectiveRules.advance_notice_days,
    effectiveRules.same_day_booking_enabled
  )
  if (advanceNoticeError) errors.push(advanceNoticeError)

  // 5. Check-in day restrictions
  const checkInDayError = validateCheckInDay(checkInDate, effectiveRules.allowed_checkin_days)
  if (checkInDayError) errors.push(checkInDayError)

  // 6. Check-out day restrictions
  const checkOutDayError = validateCheckOutDay(checkOutDate, effectiveRules.allowed_checkout_days)
  if (checkOutDayError) errors.push(checkOutDayError)

  // 7. Blackout dates
  const blackoutError = validateBlackoutDates(checkInDate, effectiveRules.blackout_dates)
  if (blackoutError) errors.push(blackoutError)

  // Return validation result
  const result: BookingRuleValidationResult = {
    is_valid: errors.length === 0,
    errors,
    rules_checked: effectiveRules,
  }

  return {
    success: true,
    data: result,
  }
}

/**
 * Quick validation helper - throws error if validation fails
 *
 * @param checkInDate - Check-in date (YYYY-MM-DD)
 * @param checkOutDate - Check-out date (YYYY-MM-DD)
 * @param options - Site/property data or IDs
 * @throws Error with validation message if any rules violated
 */
export async function assertBookingRulesValid(
  checkInDate: string,
  checkOutDate: string,
  options: ValidateBookingRulesOptions
): Promise<void> {
  const result = await validateBookingRules(checkInDate, checkOutDate, options)

  if (!result.success) {
    throw new Error(result.error.message)
  }

  if (!result.data.is_valid) {
    // Throw first error (most critical)
    const firstError = result.data.errors[0]
    if (firstError) {
      throw new Error(firstError.message)
    }
  }
}

/**
 * Get user-friendly summary of booking rules for display
 *
 * @param options - Site/property data or IDs
 * @returns Human-readable summary of applicable booking rules
 */
export async function getBookingRulesSummary(
  options: ValidateBookingRulesOptions
): Promise<BookingResult<string[]>> {
  const supabase = createServiceRoleClient()

  // Fetch site and property if not provided
  let site: SiteWithConfig | undefined = options.site
  let property: PropertyWithConfig | undefined = options.property

  if (!site && options.site_id) {
    const { data: siteData } = await supabase
      .from('sites')
      .select('*')
      .eq('id', options.site_id)
      .single()
    if (siteData) site = siteData as unknown as SiteWithConfig
  }

  if (!property && (options.property_id || site?.property_id)) {
    const propertyId = options.property_id || site!.property_id
    const { data: propertyData } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single()
    if (propertyData) property = propertyData as unknown as PropertyWithConfig
  }

  if (!property) {
    return {
      success: false,
      error: {
        code: 'MISSING_CONFIGURATION',
        message: 'Property configuration required',
      },
    }
  }

  const rules = resolveBookingRulesConfig(
    property.booking_rules_config,
    site?.booking_rules_override,
    site?.availability_rules
  ).config

  const summary: string[] = []

  // Minimum stay
  if (rules.min_stay_nights > 1) {
    summary.push(`Minimum stay: ${rules.min_stay_nights} nights`)
  }

  // Maximum stay
  if (rules.max_stay_nights) {
    summary.push(`Maximum stay: ${rules.max_stay_nights} nights`)
  }

  // Advance notice
  if (rules.advance_notice_days > 0) {
    summary.push(`Book at least ${rules.advance_notice_days} day${rules.advance_notice_days > 1 ? 's' : ''} in advance`)
  } else if (rules.same_day_booking_enabled) {
    summary.push('Same-day booking available')
  }

  // Booking window
  if (rules.booking_window_days < 365) {
    summary.push(`Can book up to ${rules.booking_window_days} days in advance`)
  }

  // Check-in days
  if (rules.allowed_checkin_days.length < 7) {
    const days = rules.allowed_checkin_days
      .map(d => d.charAt(0).toUpperCase() + d.slice(1, 3))
      .join(', ')
    summary.push(`Check-in: ${days} only`)
  }

  // Check-out days
  if (rules.allowed_checkout_days.length < 7) {
    const days = rules.allowed_checkout_days
      .map(d => d.charAt(0).toUpperCase() + d.slice(1, 3))
      .join(', ')
    summary.push(`Check-out: ${days} only`)
  }

  // Blackout dates
  if (rules.blackout_dates.length > 0) {
    summary.push(`${rules.blackout_dates.length} blackout date${rules.blackout_dates.length > 1 ? 's' : ''}`)
  }

  return {
    success: true,
    data: summary,
  }
}

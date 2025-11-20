/**
 * Test Utilities for Dynamic Date Generation
 *
 * CRITICAL: Never use hardcoded dates in tests!
 * See .claude/testing-guidelines.md for comprehensive guidance.
 */

/**
 * Get a date N days in the future from today
 * @param days - Number of days to add (can be negative for past dates)
 * @returns ISO date string (YYYY-MM-DD)
 */
export function futureDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

/**
 * Get a date N days in the past from today
 * @param days - Number of days to subtract
 * @returns ISO date string (YYYY-MM-DD)
 */
export function pastDays(days: number): string {
  return futureDays(-Math.abs(days))
}

/**
 * Get today's date at midnight
 * @returns ISO date string (YYYY-MM-DD)
 */
export function today(): string {
  return formatDate(new Date())
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse YYYY-MM-DD string to Date object
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00.000Z')
}

/**
 * Get the next occurrence of a specific day of week
 * @param dayOfWeek - 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 * @param weeksOut - How many weeks in the future (default: 0 = this week)
 * @returns ISO date string (YYYY-MM-DD)
 */
export function getNextDayOfWeek(dayOfWeek: number, weeksOut: number = 0): string {
  const today = new Date()
  const todayDayOfWeek = today.getDay()
  const daysUntilTarget = (dayOfWeek + 7 - todayDayOfWeek) % 7
  const daysToAdd = daysUntilTarget + weeksOut * 7
  return futureDays(daysToAdd === 0 ? 7 : daysToAdd)
}

/**
 * Get next Friday (common check-in day for campgrounds)
 */
export function nextFriday(weeksOut: number = 0): string {
  return getNextDayOfWeek(5, weeksOut)
}

/**
 * Get next Monday (common check-out day for campgrounds)
 */
export function nextMonday(weeksOut: number = 0): string {
  return getNextDayOfWeek(1, weeksOut)
}

/**
 * Create a date range for testing bookings
 * @param startDaysOut - Days in future for check-in (default: 7)
 * @param nights - Number of nights (default: 3)
 * @returns Object with check_in_date and check_out_date
 */
export function bookingDateRange(startDaysOut: number = 7, nights: number = 3) {
  const checkIn = futureDays(startDaysOut)
  const checkOut = futureDays(startDaysOut + nights)
  return { check_in_date: checkIn, check_out_date: checkOut }
}

/**
 * Get a weekend date range (Friday to Monday)
 * @param weeksOut - How many weeks in the future (default: 1)
 */
export function weekendDateRange(weeksOut: number = 1) {
  return {
    check_in_date: nextFriday(weeksOut),
    check_out_date: nextMonday(weeksOut),
  }
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  const start = parseDate(checkIn)
  const end = parseDate(checkOut)
  const diffTime = end.getTime() - start.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Guest booking: property open season from settings (openPeriodFrom / openPeriodUntil, YYYY-MM-DD).
 * If either is missing, bookings are allowed year-round.
 */

import { format, parse, startOfDay, subDays, isBefore, isAfter } from 'date-fns'

export function extractOpenPeriodFromPropertySettings(settings: unknown): {
  openPeriodFrom: string | null
  openPeriodUntil: string | null
} {
  if (!settings || typeof settings !== 'object') {
    return { openPeriodFrom: null, openPeriodUntil: null }
  }
  const s = settings as Record<string, unknown>
  const from = s.openPeriodFrom ?? s.open_period_from
  const until = s.openPeriodUntil ?? s.open_period_until
  const iso = (v: unknown) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  return {
    openPeriodFrom: iso(from),
    openPeriodUntil: iso(until),
  }
}

export function openPeriodRestrictsBookings(
  openPeriodFrom: string | null | undefined,
  openPeriodUntil: string | null | undefined,
): boolean {
  const f = openPeriodFrom?.trim()
  const u = openPeriodUntil?.trim()
  return Boolean(f && u)
}

function parseDay(iso: string): Date {
  return startOfDay(parse(iso, 'yyyy-MM-dd', new Date()))
}

/**
 * Check-in / check-out are exclusive end (hotel-style): nights are [checkIn, checkOut).
 * - First and last occupied nights must fall within [openPeriodFrom, openPeriodUntil].
 * - Check-out date must not be after openPeriodUntil (no departure after the season closes).
 */
export function isStayWithinOpenPeriodByIsoDates(
  checkInIso: string,
  checkOutIso: string,
  openPeriodFrom: string | null | undefined,
  openPeriodUntil: string | null | undefined,
): boolean {
  if (!openPeriodRestrictsBookings(openPeriodFrom, openPeriodUntil)) {
    return true
  }
  const fromIso = openPeriodFrom?.trim()
  const untilIso = openPeriodUntil?.trim()
  if (!fromIso || !untilIso) return true
  const from = parseDay(fromIso)
  const until = parseDay(untilIso)
  const ci = parseDay(checkInIso)
  const co = parseDay(checkOutIso)
  if (isAfter(co, until)) return false
  const lastNight = subDays(co, 1)
  if (isBefore(ci, from) || isAfter(ci, until)) return false
  if (isBefore(lastNight, from) || isAfter(lastNight, until)) return false
  return true
}

export function formatOpenPeriodGuestMessage(openPeriodFrom: string, openPeriodUntil: string): string {
  const from = parse(openPeriodFrom, 'yyyy-MM-dd', new Date())
  const until = parse(openPeriodUntil, 'yyyy-MM-dd', new Date())
  const yf = from.getFullYear()
  const yt = until.getFullYear()
  if (yf === yt) {
    return `${format(from, 'MMMM d')} to ${format(until, 'MMMM d, yyyy')}`
  }
  return `${format(from, 'MMMM d, yyyy')} to ${format(until, 'MMMM d, yyyy')}`
}

export function buildOpenPeriodBookingErrorMessage(
  propertyName: string,
  openPeriodFrom: string,
  openPeriodUntil: string,
): string {
  const range = formatOpenPeriodGuestMessage(openPeriodFrom, openPeriodUntil)
  return `The ${propertyName} property is only open for booking from ${range}.`
}

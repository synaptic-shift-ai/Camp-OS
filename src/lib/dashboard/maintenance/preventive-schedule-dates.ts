import { addDays, addMonths, addYears, format, parseISO, startOfDay } from 'date-fns'

const WEEKDAY_NAMES = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
])

export function normalizeEnglishWeekday(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  if (!t) return null
  const norm = t.slice(0, 1).toUpperCase() + t.slice(1).toLowerCase()
  return WEEKDAY_NAMES.has(norm) ? norm : null
}

export function dateOnlyFromIsoTimestamp(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const head = iso.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null
  return head
}

/** First calendar day on or after `from` (inclusive) matching weekday name, e.g. `"Monday"`. */
export function firstWeekdayOnOrAfter(from: Date, weekdayLong: string): Date {
  const target = normalizeEnglishWeekday(weekdayLong)
  if (!target) {
    throw new Error('Invalid weekday for preventive schedule')
  }
  let cur = startOfDay(from)
  for (let i = 0; i < 7; i += 1) {
    if (format(cur, 'EEEE') === target) return cur
    cur = addDays(cur, 1)
  }
  throw new Error('Could not resolve weekday occurrence')
}

/**
 * Next weekly PM occurrence: same weekday as `previousDateOnly` + 7 days when known;
 * otherwise the next matching weekday strictly after completion (local calendar).
 */
export function computeNextWeeklyOccurrence(
  previousScheduledDateOnly: string | null,
  daysField: string | null | undefined,
  completedAt: Date,
): Date {
  const weekday = normalizeEnglishWeekday(daysField)
  if (!weekday) {
    throw new Error('Weekly schedule is missing a valid day of week')
  }
  if (previousScheduledDateOnly) {
    const base = parseISO(`${previousScheduledDateOnly}T12:00:00`)
    return addDays(base, 7)
  }
  const afterCompletion = addDays(startOfDay(completedAt), 1)
  return firstWeekdayOnOrAfter(afterCompletion, weekday)
}

/** First scheduled day for a new weekly work order (on or after `from`). */
export function computeInitialWeeklyOccurrence(from: Date, daysField: string | null | undefined): Date {
  const weekday = normalizeEnglishWeekday(daysField)
  if (!weekday) {
    throw new Error('Weekly schedule is missing a valid day of week')
  }
  return firstWeekdayOnOrAfter(startOfDay(from), weekday)
}

export function localMidnightIsoFromDate(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString()
}

export function localEndOfDayIsoFromDate(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0, 0).toISOString()
}

export function computeNextMonthlyOccurrence(
  previousScheduledDateOnly: string | null,
  completedAt: Date,
): Date {
  const anchor = previousScheduledDateOnly
    ? parseISO(`${previousScheduledDateOnly}T12:00:00`)
    : startOfDay(completedAt)
  return addMonths(anchor, 1)
}

export function computeNextAnnualOccurrence(
  previousScheduledDateOnly: string | null,
  completedAt: Date,
): Date {
  const anchor = previousScheduledDateOnly
    ? parseISO(`${previousScheduledDateOnly}T12:00:00`)
    : startOfDay(completedAt)
  return addYears(anchor, 1)
}

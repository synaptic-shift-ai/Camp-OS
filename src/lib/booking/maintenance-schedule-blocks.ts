import { addDays, addMonths, format, parseISO, startOfMonth } from 'date-fns'

export type MaintenanceScheduleAvailabilityRow = {
  frequency: string
  schedule_date: string | null
  days: string | null
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/** Last calendar day in month (1–12). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function clampDayInMonth(year: number, month: number, dayOfMonth: number): string {
  const last = daysInMonth(year, month)
  const d = Math.min(Math.max(1, dayOfMonth), last)
  return toIso(year, month, d)
}

function parseIsoDayOrNull(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!iso?.trim()) return null
  const m = ISO_DAY.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  return { y, m: mo, d }
}

const WEEKDAY_NAMES = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
])

/**
 * Guest stay overlaps a preventive maintenance calendar day when the maintenance date
 * falls between check-in and check-out inclusive on the calendar. This matches blocking
 * when checkout falls on a scheduled maintenance day (e.g. Jun 6–7 with maintenance on the 7th).
 */
export function stayOverlapsMaintenanceCalendarDay(
  checkInDate: string,
  checkOutDate: string,
  maintenanceDayIso: string,
): boolean {
  return checkInDate <= maintenanceDayIso && checkOutDate >= maintenanceDayIso
}

function eachMonthTouchingStay(checkInDate: string, checkOutDate: string): Array<{ y: number; m: number }> {
  const start = parseISO(`${checkInDate}T12:00:00`)
  const end = parseISO(`${checkOutDate}T12:00:00`)
  const months: Array<{ y: number; m: number }> = []
  let cur = startOfMonth(start)
  const endMonth = startOfMonth(end)
  while (cur <= endMonth) {
    months.push({ y: cur.getFullYear(), m: cur.getMonth() + 1 })
    cur = addMonths(cur, 1)
  }
  return months
}

function monthlyScheduleBlocksStay(
  checkInDate: string,
  checkOutDate: string,
  scheduleDate: string | null,
): boolean {
  const parsed = parseIsoDayOrNull(scheduleDate)
  if (!parsed) return false
  const dayOfMonth = parsed.d
  for (const { y, m } of eachMonthTouchingStay(checkInDate, checkOutDate)) {
    const candidate = clampDayInMonth(y, m, dayOfMonth)
    if (stayOverlapsMaintenanceCalendarDay(checkInDate, checkOutDate, candidate)) {
      return true
    }
  }
  return false
}

function annualScheduleBlocksStay(
  checkInDate: string,
  checkOutDate: string,
  scheduleDate: string | null,
): boolean {
  const parsed = parseIsoDayOrNull(scheduleDate)
  if (!parsed) return false
  const month = parsed.m
  const day = parsed.d
  const startY = parseISO(`${checkInDate}T12:00:00`).getFullYear()
  const endY = parseISO(`${checkOutDate}T12:00:00`).getFullYear()
  for (let y = startY; y <= endY; y += 1) {
    const candidate = clampDayInMonth(y, month, day)
    if (stayOverlapsMaintenanceCalendarDay(checkInDate, checkOutDate, candidate)) {
      return true
    }
  }
  return false
}

function normalizeEnglishWeekday(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  if (!t) return null
  const norm = t.slice(0, 1).toUpperCase() + t.slice(1).toLowerCase()
  return WEEKDAY_NAMES.has(norm) ? norm : null
}

function weeklyScheduleBlocksStay(
  checkInDate: string,
  checkOutDate: string,
  weekdayName: string | null,
): boolean {
  const day = normalizeEnglishWeekday(weekdayName)
  if (!day) return false
  let cur = checkInDate
  while (cur <= checkOutDate) {
    const label = format(parseISO(`${cur}T12:00:00`), 'EEEE')
    if (label === day) return true
    cur = format(addDays(parseISO(`${cur}T12:00:00`), 1), 'yyyy-MM-dd')
  }
  return false
}

/**
 * Returns true when a guest stay (check-in / check-out as stored on reservations) conflicts
 * with a recurring maintenance_schedule row for booking availability.
 */
export function stayOverlapsPreventiveMaintenanceSchedule(
  checkInDate: string,
  checkOutDate: string,
  schedule: MaintenanceScheduleAvailabilityRow,
): boolean {
  const frequency = schedule.frequency.trim().toLowerCase()
  if (frequency === 'monthly') {
    return monthlyScheduleBlocksStay(checkInDate, checkOutDate, schedule.schedule_date)
  }
  if (frequency === 'annual') {
    return annualScheduleBlocksStay(checkInDate, checkOutDate, schedule.schedule_date)
  }
  if (frequency === 'weekly') {
    return weeklyScheduleBlocksStay(checkInDate, checkOutDate, schedule.days)
  }
  return false
}

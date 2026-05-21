/**
 * Cron Expression Evaluator
 *
 * Lightweight 5-field cron expression evaluator.
 * No external dependencies - pure TypeScript.
 *
 * Supported syntax per field:
 *   *       - any value
 *   * / n   - every nth value (star-slash-n)
 *   n       - exact value
 *   n,m     - list of values
 *   n-m     - range (inclusive)
 *   Combined: 0,30 * / 2 * * *
 *
 * All evaluation is done in UTC. The caller is responsible for
 * converting the evaluation time using a timezone offset.
 */

export interface CronEvaluatorResult {
  isDue: boolean
  humanReadable: string
}

interface FieldRange {
  min: number
  max: number
}

// Field ranges: minute, hour, day-of-month, month, day-of-week
const FIELD_RANGES: FieldRange[] = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12 },
  { min: 0, max: 7 },
]

const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/**
 * Parse a single cron field into a Set of matching integer values.
 */
function parseField(field: string, fieldIndex: number): Set<number> {
  const range: FieldRange = FIELD_RANGES[fieldIndex] ?? { min: 0, max: 59 }
  const values = new Set<number>()

  // Normalize day/month names to numbers
  let normalized = field.toLowerCase()
  for (const [name, num] of Object.entries(DAY_NAMES)) {
    normalized = normalized.replace(new RegExp('\\b' + name + '\\b', 'g'), String(num))
  }
  for (const [name, num] of Object.entries(MONTH_NAMES)) {
    normalized = normalized.replace(new RegExp('\\b' + name + '\\b', 'g'), String(num))
  }

  const parts = normalized.split(',')

  for (const part of parts) {
    const trimmed = part.trim()

    if (trimmed === '*') {
      for (let i = range.min; i <= range.max; i++) values.add(i)
      continue
    }

    // * / n - every nth value
    const stepMatch = trimmed.match(/^\*\/(\d+)$/)
    if (stepMatch && stepMatch[1]) {
      const step = parseInt(stepMatch[1], 10)
      if (step <= 0) throw new Error('Invalid step value in cron field: ' + trimmed)
      for (let i = range.min; i <= range.max; i += step) values.add(i)
      continue
    }

    // n-m - range
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/)
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const lo = parseInt(rangeMatch[1], 10)
      const hi = parseInt(rangeMatch[2], 10)
      for (let i = lo; i <= hi; i++) values.add(i)
      continue
    }

    // n-m/s - range with step
    const rangeStepMatch = trimmed.match(/^(\d+)-(\d+)\/(\d+)$/)
    if (rangeStepMatch && rangeStepMatch[1] && rangeStepMatch[2] && rangeStepMatch[3]) {
      const lo = parseInt(rangeStepMatch[1], 10)
      const hi = parseInt(rangeStepMatch[2], 10)
      const step = parseInt(rangeStepMatch[3], 10)
      for (let i = lo; i <= hi; i += step) values.add(i)
      continue
    }

    // n - exact value
    const exactMatch = trimmed.match(/^\d+$/)
    if (exactMatch) {
      values.add(parseInt(trimmed, 10))
      continue
    }

    throw new Error('Invalid cron field: ' + trimmed)
  }

  return values
}

/**
 * Evaluate a standard 5-field cron expression against a given Date (UTC).
 */
export function evaluateCron(expression: string, now: Date): CronEvaluatorResult {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5 || !fields[0] || !fields[1] || !fields[2] || !fields[3] || !fields[4]) {
    throw new Error('Cron expression must have exactly 5 fields, got ' + fields.length + ': "' + expression + '"')
  }

  const fieldsTuple: [string, string, string, string, string] = [
    fields[0] ?? '*',
    fields[1] ?? '*',
    fields[2] ?? '*',
    fields[3] ?? '*',
    fields[4] ?? '*',
  ]

  const minuteSet = parseField(fieldsTuple[0], 0)
  const hourSet = parseField(fieldsTuple[1], 1)
  const domSet = parseField(fieldsTuple[2], 2)
  const monthSet = parseField(fieldsTuple[3], 3)
  const dowSet = parseField(fieldsTuple[4], 4)

  const minute = now.getUTCMinutes()
  const hour = now.getUTCHours()
  const dom = now.getUTCDate()
  const month = now.getUTCMonth() + 1
  const dow = now.getUTCDay()

  // Day-of-week: 0 and 7 both mean Sunday
  const dowMatches = dowSet.has(dow) || (dow === 0 && dowSet.has(7))

  const domIsWildcard = fieldsTuple[2] === '*'
  const dowIsWildcard = fieldsTuple[4] === '*'

  let dayMatches: boolean
  if (domIsWildcard && dowIsWildcard) {
    dayMatches = true
  } else if (domIsWildcard) {
    dayMatches = dowMatches
  } else if (dowIsWildcard) {
    dayMatches = domSet.has(dom)
  } else {
    dayMatches = domSet.has(dom) || dowMatches
  }

  const isDue =
    minuteSet.has(minute) &&
    hourSet.has(hour) &&
    monthSet.has(month) &&
    dayMatches

  return {
    isDue,
    humanReadable: cronToHumanReadable(fieldsTuple),
  }
}

/**
 * Convert a human description preset to a cron expression.
 */
export function presetToCron(preset: string): string {
  const presets: Record<string, string> = {
    'every-hour': '0 * * * *',
    'every-6-hours': '0 */6 * * *',
    'every-day-8am': '0 8 * * *',
    'every-day-9am': '0 9 * * *',
    'every-monday-9am': '0 9 * * 1',
    'every-5-minutes': '*/5 * * * *',
    'every-15-minutes': '*/15 * * * *',
    'every-30-minutes': '*/30 * * * *',
    'first-of-month': '0 0 1 * *',
  }

  const result = presets[preset]
  if (!result) {
    throw new Error('Unknown preset: ' + preset + '. Available: ' + Object.keys(presets).join(', '))
  }
  return result
}

/**
 * Generate a human-readable description of a cron expression.
 */
function cronToHumanReadable(fields: [string, string, string, string, string]): string {
  const minField = fields[0]
  const hourField = fields[1]
  const domField = fields[2]
  const monthField = fields[3]
  const dowField = fields[4]

  // Every minute
  if (minField === '*' && hourField === '*' && domField === '*' && monthField === '*' && dowField === '*') {
    return 'Every minute'
  }

  // Every N minutes
  const minStepMatch = minField.match(/^\*\/(\d+)$/)
  if (minStepMatch && minStepMatch[1] && hourField === '*' && domField === '*' && monthField === '*' && dowField === '*') {
    return 'Every ' + minStepMatch[1] + ' minutes'
  }

  // Specific time, every day
  if (isSimple(minField) && isSimple(hourField) && domField === '*' && monthField === '*' && dowField === '*') {
    const h = parseInt(hourField, 10)
    const m = parseInt(minField, 10)
    return 'Every day at ' + formatTime(h, m)
  }

  // Specific time, specific day of week
  if (isSimple(minField) && isSimple(hourField) && domField === '*' && monthField === '*' && isSimple(dowField)) {
    const h = parseInt(hourField, 10)
    const m = parseInt(minField, 10)
    const dayName = dowToName(parseInt(dowField, 10))
    return 'Every ' + dayName + ' at ' + formatTime(h, m)
  }

  // Every N hours
  const hourStepMatch = hourField.match(/^\*\/(\d+)$/)
  if (minField === '0' && hourStepMatch && hourStepMatch[1] && domField === '*' && monthField === '*' && dowField === '*') {
    return 'Every ' + hourStepMatch[1] + ' hours'
  }

  // First of month
  if (minField === '0' && hourField === '0' && domField === '1' && monthField === '*' && dowField === '*') {
    return 'First day of every month at 12:00 AM'
  }

  // Every weekday
  if (isSimple(minField) && isSimple(hourField) && domField === '*' && monthField === '*' && dowField === '1-5') {
    const h = parseInt(hourField, 10)
    const m = parseInt(minField, 10)
    return 'Every weekday at ' + formatTime(h, m)
  }

  // Fallback
  return 'Cron: minute=' + minField + ' hour=' + hourField + ' day=' + domField + ' month=' + monthField + ' weekday=' + dowField
}

function isSimple(field: string): boolean {
  return /^\d+$/.test(field)
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const mStr = minute.toString().padStart(2, '0')
  return h12 + ':' + mStr + ' ' + period
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dowToName(dow: number): string {
  const idx = dow === 7 ? 0 : dow
  return DOW_NAMES[idx] ?? 'day(' + dow + ')'
}

/**
 * Get the UTC offset in minutes for a given IANA timezone and date.
 * Positive offset means the timezone is ahead of UTC.
 *
 * Uses Intl.DateTimeFormat to resolve the offset - no external deps needed.
 */
export function getTimezoneOffset(timezone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  })

  const parts = formatter.formatToParts(date)
  const tzPart = parts.find((p) => p.type === 'timeZoneName')

  if (!tzPart) {
    // Fallback: use long format
    const longFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'long',
    })
    const longParts = longFormatter.formatToParts(date)
    const longTzPart = longParts.find((p) => p.type === 'timeZoneName')
    if (!longTzPart || longTzPart.value === 'GMT') return 0
    return parseOffsetString(longTzPart.value)
  }

  return parseOffsetString(tzPart.value)
}

function parseOffsetString(s: string): number {
  const match = s.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0

  const sign = match[1] === '+' ? 1 : -1
  const hours = parseInt(match[2] ?? '0', 10)
  const minutes = match[3] ? parseInt(match[3], 10) : 0

  return sign * (hours * 60 + minutes)
}

/**
 * Validate that a string is a valid IANA timezone.
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

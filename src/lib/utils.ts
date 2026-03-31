import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function asYyyyMmDd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function normalizeDateString(date: string): string {
  // Accept either YYYY-MM-DD or ISO datetime and normalize to YYYY-MM-DD
  return date.length >= 10 ? date.slice(0, 10) : date
}

export function formatDisplayDate(yyyyMmDd: string): string {
  const [year, month, day] = yyyyMmDd.split('-').map(Number)
  if (!year || !month || !day) return yyyyMmDd
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function dayOfWeekFromYyyyMmDd(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T00:00:00')
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[d.getDay()]!
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('')
}

export function formatUtcDateLabel(dateUtcMidnight: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dateUtcMidnight)
}

export function formatUtcMonthShort(dateUtcMidnight: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(dateUtcMidnight)
}

export function formatUtcDayNumber(dateUtcMidnight: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dateUtcMidnight)
}

export function formatUtcMonthLabel(dateUtcMidnight: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateUtcMidnight)
}

export function formatUtcYmd(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getStatusLabel(status: string): string {
  return status.replace('_', ' ')
}

export function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function capitalizeWordsPreserveSpacing(name: string): string {
  return name
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part
      if (!part) return part
      const lower = part.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

export function getFirstLastInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  const last = parts[parts.length - 1] ?? ''

  if (!first) return ''
  if (!last || parts.length === 1) return first.charAt(0).toUpperCase()
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

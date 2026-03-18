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

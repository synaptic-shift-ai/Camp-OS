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

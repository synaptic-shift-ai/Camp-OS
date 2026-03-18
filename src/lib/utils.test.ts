import { describe, it, expect } from 'vitest'
import { cn, formatMoney, getInitials } from './utils'

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    const result = cn('text-red-500', 'bg-blue-500')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-500')
  })

  it('should handle conditional class names', () => {
    const isActive = true
    const result = cn('base-class', isActive && 'active-class')
    expect(result).toContain('base-class')
    expect(result).toContain('active-class')
  })

  it('should filter out falsy values', () => {
    const result = cn('base-class', false && 'hidden-class', null, undefined)
    expect(result).toContain('base-class')
    expect(result).not.toContain('hidden-class')
  })
})

describe('display helpers', () => {
  it('formatMoney should format cents as USD', () => {
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(12345)).toBe('$123.45')
  })

  it('getInitials should return initials from space-separated names', () => {
    expect(getInitials('John Smith')).toBe('JS')
    expect(getInitials(' Jane   Smith  ')).toBe('JS')
  })
})

/**
 * DateRange Value Object Tests
 *
 * Following CLAUDE.md testing best practices:
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterize test inputs
 * - T-8: Test description states what expect verifies
 * - T-10: Test edge cases and boundaries
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { DateRange } from '../DateRange'

describe('DateRange', () => {
  // Helper to create dates at midnight UTC
  const createDate = (year: number, month: number, day: number): Date => {
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    return date
  }

  // Test data
  const futureCheckIn = createDate(2025, 12, 1)
  const futureCheckOut = createDate(2025, 12, 5)
  const pastCheckIn = createDate(2024, 1, 1)
  const pastCheckOut = createDate(2024, 1, 5)

  describe('create', () => {
    test('should create valid date range for future dates', () => {
      const dateRange = DateRange.create(futureCheckIn, futureCheckOut)

      expect(dateRange.checkIn).toEqual(futureCheckIn)
      expect(dateRange.checkOut).toEqual(futureCheckOut)
      expect(dateRange.nights).toBe(4)
    })

    test('should allow past dates when allowPastDates is true', () => {
      const dateRange = DateRange.create(pastCheckIn, pastCheckOut, true)

      expect(dateRange.checkIn).toEqual(pastCheckIn)
      expect(dateRange.checkOut).toEqual(pastCheckOut)
    })

    test('should reject past check-in date by default', () => {
      expect(() => DateRange.create(pastCheckIn, pastCheckOut)).toThrow(
        'Check-in date cannot be in the past'
      )
    })

    test('should reject check-out before check-in', () => {
      const checkIn = createDate(2025, 12, 10)
      const checkOut = createDate(2025, 12, 5)

      expect(() => DateRange.create(checkIn, checkOut)).toThrow(
        'Check-out date must be after check-in date'
      )
    })

    test('should reject same-day check-in and check-out', () => {
      const sameDay = createDate(2025, 12, 1)

      expect(() => DateRange.create(sameDay, sameDay)).toThrow(
        'Check-out date must be after check-in date'
      )
    })

    test('should reject stay shorter than minimum (1 night)', () => {
      // This would be caught by the "check-out must be after check-in" rule
      // since minimum is 1 night, same-day booking is invalid
      const checkIn = createDate(2025, 12, 1)
      const checkOut = createDate(2025, 12, 1)

      expect(() => DateRange.create(checkIn, checkOut)).toThrow()
    })

    test('should reject stay longer than maximum (365 nights)', () => {
      const checkIn = createDate(2025, 12, 1)
      const checkOut = createDate(2027, 1, 1) // More than 365 days

      expect(() => DateRange.create(checkIn, checkOut)).toThrow(
        'Maximum stay is 365 nights'
      )
    })

    test('should normalize dates to midnight UTC', () => {
      const checkInWithTime = new Date('2025-12-01T15:30:00Z')
      const checkOutWithTime = new Date('2025-12-05T22:45:00Z')

      const dateRange = DateRange.create(checkInWithTime, checkOutWithTime)

      expect(dateRange.checkIn.getUTCHours()).toBe(0)
      expect(dateRange.checkIn.getUTCMinutes()).toBe(0)
      expect(dateRange.checkOut.getUTCHours()).toBe(0)
      expect(dateRange.checkOut.getUTCMinutes()).toBe(0)
    })
  })

  describe('nights', () => {
    test('should calculate 1 night for consecutive days', () => {
      const checkIn = createDate(2025, 12, 1)
      const checkOut = createDate(2025, 12, 2)
      const dateRange = DateRange.create(checkIn, checkOut)

      expect(dateRange.nights).toBe(1)
    })

    test('should calculate 7 nights for one week', () => {
      const checkIn = createDate(2025, 12, 1)
      const checkOut = createDate(2025, 12, 8)
      const dateRange = DateRange.create(checkIn, checkOut)

      expect(dateRange.nights).toBe(7)
    })

    test('should calculate 30 nights for one month', () => {
      const checkIn = createDate(2025, 12, 1)
      const checkOut = createDate(2025, 12, 31)
      const dateRange = DateRange.create(checkIn, checkOut)

      expect(dateRange.nights).toBe(30)
    })
  })

  describe('overlaps', () => {
    test('should detect overlap when ranges partially overlap', () => {
      const range1 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )
      const range2 = DateRange.create(
        createDate(2025, 12, 3),
        createDate(2025, 12, 7)
      )

      expect(range1.overlaps(range2)).toBe(true)
      expect(range2.overlaps(range1)).toBe(true) // Commutative
    })

    test('should detect overlap when one range contains another', () => {
      const outer = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 10)
      )
      const inner = DateRange.create(
        createDate(2025, 12, 3),
        createDate(2025, 12, 7)
      )

      expect(outer.overlaps(inner)).toBe(true)
      expect(inner.overlaps(outer)).toBe(true)
    })

    test('should not detect overlap when ranges are consecutive (check-out = check-in)', () => {
      const range1 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )
      const range2 = DateRange.create(
        createDate(2025, 12, 5),
        createDate(2025, 12, 10)
      )

      expect(range1.overlaps(range2)).toBe(false)
      expect(range2.overlaps(range1)).toBe(false)
    })

    test('should not detect overlap when ranges are separate', () => {
      const range1 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )
      const range2 = DateRange.create(
        createDate(2025, 12, 10),
        createDate(2025, 12, 15)
      )

      expect(range1.overlaps(range2)).toBe(false)
      expect(range2.overlaps(range1)).toBe(false)
    })

    test('should detect overlap when ranges are identical', () => {
      const range1 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )
      const range2 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(range1.overlaps(range2)).toBe(true)
    })
  })

  describe('contains', () => {
    test('should return true for date on check-in day', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(range.contains(createDate(2025, 12, 1))).toBe(true)
    })

    test('should return true for date in middle of stay', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(range.contains(createDate(2025, 12, 3))).toBe(true)
    })

    test('should return false for check-out day (check-out is exclusive)', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(range.contains(createDate(2025, 12, 5))).toBe(false)
    })

    test('should return false for date before check-in', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(range.contains(createDate(2025, 11, 30))).toBe(false)
    })

    test('should return false for date after check-out', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(range.contains(createDate(2025, 12, 6))).toBe(false)
    })
  })

  describe('extend', () => {
    test('should extend check-out by specified nights', () => {
      const original = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      const extended = original.extend(3)

      expect(extended.checkIn).toEqual(original.checkIn)
      expect(extended.checkOut).toEqual(createDate(2025, 12, 8))
      expect(extended.nights).toBe(7) // Original 4 + 3
    })

    test('should reject extension with zero nights', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(() => range.extend(0)).toThrow(
        'Additional nights must be positive'
      )
    })

    test('should reject extension with negative nights', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(() => range.extend(-2)).toThrow(
        'Additional nights must be positive'
      )
    })

    test('should reject extension that would exceed maximum stay', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2026, 11, 30) // 364 nights
      )

      expect(() => range.extend(2)).toThrow(
        'Total stay cannot exceed 365 nights'
      )
    })
  })

  describe('shorten', () => {
    test('should shorten check-out by specified nights', () => {
      const original = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 8)
      )

      const shortened = original.shorten(3)

      expect(shortened.checkIn).toEqual(original.checkIn)
      expect(shortened.checkOut).toEqual(createDate(2025, 12, 5))
      expect(shortened.nights).toBe(4) // Original 7 - 3
    })

    test('should reject shortening that would violate minimum stay', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 3) // 2 nights
      )

      // Shortening by 2 nights would result in same-day check-in/check-out
      expect(() => range.shorten(2)).toThrow(
        'Check-out date must be after check-in date'
      )
    })

    test('should reject shortening with zero nights', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(() => range.shorten(0)).toThrow(
        'Nights to remove must be positive'
      )
    })
  })

  describe('getDates', () => {
    test('should return array of all dates in range (excluding check-out)', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      const dates = range.getDates()

      expect(dates).toHaveLength(4) // 4 nights
      expect(dates[0]).toEqual(createDate(2025, 12, 1))
      expect(dates[1]).toEqual(createDate(2025, 12, 2))
      expect(dates[2]).toEqual(createDate(2025, 12, 3))
      expect(dates[3]).toEqual(createDate(2025, 12, 4))
    })

    test('should return single date for one-night stay', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 2)
      )

      const dates = range.getDates()

      expect(dates).toHaveLength(1)
      expect(dates[0]).toEqual(createDate(2025, 12, 1))
    })
  })

  describe('isPast/isFuture/isActive', () => {
    test('should identify past date range', () => {
      const pastRange = DateRange.create(pastCheckIn, pastCheckOut, true)

      expect(pastRange.isPast()).toBe(true)
      expect(pastRange.isFuture()).toBe(false)
      expect(pastRange.isActive()).toBe(false)
    })

    test('should identify future date range', () => {
      const futureRange = DateRange.create(futureCheckIn, futureCheckOut)

      expect(futureRange.isPast()).toBe(false)
      expect(futureRange.isFuture()).toBe(true)
      expect(futureRange.isActive()).toBe(false)
    })

    // Note: isActive() test would be flaky as it depends on current date
    // In production code, we'd inject a clock service for testing
  })

  describe('toString', () => {
    test('should format date range as readable string with singular night', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 2)
      )

      expect(range.toString()).toBe('2025-12-01 to 2025-12-02 (1 night)')
    })

    test('should format date range as readable string with plural nights', () => {
      const range = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(range.toString()).toBe('2025-12-01 to 2025-12-05 (4 nights)')
    })
  })

  describe('equality', () => {
    test('should consider two ranges with same dates as equal', () => {
      const range1 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )
      const range2 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )

      expect(range1.equals(range2)).toBe(true)
    })

    test('should consider two ranges with different check-in as not equal', () => {
      const range1 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )
      const range2 = DateRange.create(
        createDate(2025, 12, 2),
        createDate(2025, 12, 5)
      )

      expect(range1.equals(range2)).toBe(false)
    })

    test('should consider two ranges with different check-out as not equal', () => {
      const range1 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 5)
      )
      const range2 = DateRange.create(
        createDate(2025, 12, 1),
        createDate(2025, 12, 6)
      )

      expect(range1.equals(range2)).toBe(false)
    })
  })
})

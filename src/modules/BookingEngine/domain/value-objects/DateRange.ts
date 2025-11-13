/**
 * DateRange Value Object
 *
 * Represents a valid date range for a reservation.
 * Enforces business rules around check-in/check-out dates.
 *
 * Business Rules:
 * - Check-in date must be in the future (or today for same-day bookings)
 * - Check-out date must be after check-in date
 * - Minimum stay: 1 night
 * - Maximum stay: 365 nights (1 year)
 */

import { ValueObject } from '@/shared/domain/ValueObject'
import { addDays, differenceInDays, isAfter, isBefore, startOfDay } from 'date-fns'

export interface DateRangeProps {
  checkIn: Date
  checkOut: Date
}

export class DateRange extends ValueObject<DateRangeProps> {
  private static readonly MIN_STAY_NIGHTS = 1
  private static readonly MAX_STAY_NIGHTS = 365

  private constructor(props: DateRangeProps) {
    super(props)
  }

  static create(checkIn: Date, checkOut: Date): DateRange {
    // Normalize to start of day to avoid time-of-day issues
    const normalizedCheckIn = startOfDay(checkIn)
    const normalizedCheckOut = startOfDay(checkOut)

    // Validate check-out is after check-in
    if (!isAfter(normalizedCheckOut, normalizedCheckIn)) {
      throw new Error('Check-out date must be after check-in date')
    }

    // Calculate nights
    const nights = differenceInDays(normalizedCheckOut, normalizedCheckIn)

    // Validate minimum stay
    if (nights < this.MIN_STAY_NIGHTS) {
      throw new Error(`Minimum stay is ${this.MIN_STAY_NIGHTS} night(s)`)
    }

    // Validate maximum stay
    if (nights > this.MAX_STAY_NIGHTS) {
      throw new Error(`Maximum stay is ${this.MAX_STAY_NIGHTS} nights`)
    }

    return new DateRange({
      checkIn: normalizedCheckIn,
      checkOut: normalizedCheckOut,
    })
  }

  /**
   * Create from ISO date strings (YYYY-MM-DD)
   */
  static createFromStrings(checkIn: string, checkOut: string): DateRange {
    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)

    if (isNaN(checkInDate.getTime())) {
      throw new Error('Invalid check-in date format')
    }

    if (isNaN(checkOutDate.getTime())) {
      throw new Error('Invalid check-out date format')
    }

    return this.create(checkInDate, checkOutDate)
  }

  get checkIn(): Date {
    return this.props.checkIn
  }

  get checkOut(): Date {
    return this.props.checkOut
  }

  /**
   * Calculate number of nights
   */
  get nights(): number {
    return differenceInDays(this.checkOut, this.checkIn)
  }

  /**
   * Check if this date range overlaps with another
   */
  overlapsWith(other: DateRange): boolean {
    // Ranges overlap if:
    // - This check-in is before other's check-out AND
    // - This check-out is after other's check-in
    return (
      isBefore(this.checkIn, other.checkOut) &&
      isAfter(this.checkOut, other.checkIn)
    )
  }

  /**
   * Check if this range contains a specific date
   */
  containsDate(date: Date): boolean {
    const normalizedDate = startOfDay(date)
    return (
      (normalizedDate >= this.checkIn && normalizedDate < this.checkOut) ||
      normalizedDate.getTime() === this.checkIn.getTime()
    )
  }

  /**
   * Check if check-in date is in the past
   */
  isPast(): boolean {
    const today = startOfDay(new Date())
    return isBefore(this.checkIn, today)
  }

  /**
   * Check if check-in date is today
   */
  isToday(): boolean {
    const today = startOfDay(new Date())
    return this.checkIn.getTime() === today.getTime()
  }

  /**
   * Get ISO date strings for database storage
   */
  toStrings(): { checkIn: string; checkOut: string } {
    return {
      checkIn: this.checkIn.toISOString().split('T')[0],
      checkOut: this.checkOut.toISOString().split('T')[0],
    }
  }

  /**
   * Extend the date range by adding days to check-out
   */
  extendBy(days: number): DateRange {
    if (days <= 0) {
      throw new Error('Extension must be positive number of days')
    }

    const newCheckOut = addDays(this.checkOut, days)
    return DateRange.create(this.checkIn, newCheckOut)
  }
}

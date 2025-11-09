/**
 * DateRange Value Object
 *
 * Represents a date range for a reservation (check-in to check-out).
 * Enforces business rules around valid date ranges.
 *
 * Business Rules:
 * - Check-out must be after check-in
 * - Minimum stay: 1 night
 * - Maximum stay: 365 nights (configurable)
 * - No same-day check-in/check-out
 * - Dates must be in the future (for new reservations)
 */

import { ValueObject } from '@/shared/domain/ValueObject'

interface DateRangeProps {
  checkIn: Date
  checkOut: Date
}

export class DateRange extends ValueObject<DateRangeProps> {
  // Business rule constants
  private static readonly MIN_NIGHTS = 1
  private static readonly MAX_NIGHTS = 365

  private constructor(props: DateRangeProps) {
    super(props)
  }

  /**
   * Factory method to create a DateRange
   *
   * @param checkIn - Check-in date
   * @param checkOut - Check-out date
   * @param allowPastDates - Whether to allow past dates (default: false)
   * @returns DateRange instance
   * @throws Error if validation fails
   */
  public static create(
    checkIn: Date,
    checkOut: Date,
    allowPastDates = false
  ): DateRange {
    // Normalize dates to midnight UTC to avoid timezone issues
    const normalizedCheckIn = DateRange.normalizeDate(checkIn)
    const normalizedCheckOut = DateRange.normalizeDate(checkOut)

    // Validate date range
    DateRange.validateDateRange(normalizedCheckIn, normalizedCheckOut, allowPastDates)

    return new DateRange({
      checkIn: normalizedCheckIn,
      checkOut: normalizedCheckOut,
    })
  }

  /**
   * Normalize date to midnight UTC
   * This prevents timezone-related bugs
   */
  private static normalizeDate(date: Date): Date {
    const normalized = new Date(date)
    normalized.setUTCHours(0, 0, 0, 0)
    return normalized
  }

  /**
   * Validate date range according to business rules
   */
  private static validateDateRange(
    checkIn: Date,
    checkOut: Date,
    allowPastDates: boolean
  ): void {
    const now = new Date()
    now.setUTCHours(0, 0, 0, 0)

    // Rule 1: Check-in date must not be in the past (unless explicitly allowed)
    if (!allowPastDates && checkIn < now) {
      throw new Error('Check-in date cannot be in the past')
    }

    // Rule 2: Check-out must be after check-in
    if (checkOut <= checkIn) {
      throw new Error('Check-out date must be after check-in date')
    }

    // Rule 3: Calculate nights and validate min/max stay
    const nights = DateRange.calculateNights(checkIn, checkOut)

    if (nights < DateRange.MIN_NIGHTS) {
      throw new Error(`Minimum stay is ${DateRange.MIN_NIGHTS} night(s)`)
    }

    if (nights > DateRange.MAX_NIGHTS) {
      throw new Error(`Maximum stay is ${DateRange.MAX_NIGHTS} nights`)
    }
  }

  /**
   * Calculate number of nights between check-in and check-out
   */
  private static calculateNights(checkIn: Date, checkOut: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000
    return Math.round((checkOut.getTime() - checkIn.getTime()) / msPerDay)
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get checkIn(): Date {
    return this.props.checkIn
  }

  get checkOut(): Date {
    return this.props.checkOut
  }

  get nights(): number {
    return DateRange.calculateNights(this.props.checkIn, this.props.checkOut)
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Check if this date range overlaps with another
   *
   * Two ranges overlap if:
   * - Range A starts before Range B ends AND
   * - Range A ends after Range B starts
   *
   * @param other - Another DateRange to check against
   * @returns true if ranges overlap
   */
  public overlaps(other: DateRange): boolean {
    return (
      this.props.checkIn < other.props.checkOut &&
      this.props.checkOut > other.props.checkIn
    )
  }

  /**
   * Check if a specific date falls within this range (inclusive)
   *
   * @param date - Date to check
   * @returns true if date is within range
   */
  public contains(date: Date): boolean {
    const normalized = DateRange.normalizeDate(date)
    return (
      normalized >= this.props.checkIn &&
      normalized < this.props.checkOut // Check-out day is exclusive
    )
  }

  /**
   * Check if this date range is in the past
   */
  public isPast(): boolean {
    const now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    return this.props.checkOut < now
  }

  /**
   * Check if this date range is in the future
   */
  public isFuture(): boolean {
    const now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    return this.props.checkIn > now
  }

  /**
   * Check if this date range is currently active (today falls within range)
   */
  public isActive(): boolean {
    const now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    return this.contains(now)
  }

  /**
   * Extend the check-out date by a number of nights
   *
   * @param additionalNights - Number of nights to add
   * @returns New DateRange with extended check-out
   */
  public extend(additionalNights: number): DateRange {
    if (additionalNights <= 0) {
      throw new Error('Additional nights must be positive')
    }

    const newCheckOut = new Date(this.props.checkOut)
    newCheckOut.setUTCDate(newCheckOut.getUTCDate() + additionalNights)

    // Validate the new range doesn't exceed max stay
    const totalNights = this.nights + additionalNights
    if (totalNights > DateRange.MAX_NIGHTS) {
      throw new Error(
        `Total stay cannot exceed ${DateRange.MAX_NIGHTS} nights`
      )
    }

    return new DateRange({
      checkIn: this.props.checkIn,
      checkOut: newCheckOut,
    })
  }

  /**
   * Shorten the check-out date by a number of nights
   *
   * @param nightsToRemove - Number of nights to remove
   * @returns New DateRange with shortened check-out
   */
  public shorten(nightsToRemove: number): DateRange {
    if (nightsToRemove <= 0) {
      throw new Error('Nights to remove must be positive')
    }

    const newCheckOut = new Date(this.props.checkOut)
    newCheckOut.setUTCDate(newCheckOut.getUTCDate() - nightsToRemove)

    // This will validate min nights
    return DateRange.create(this.props.checkIn, newCheckOut, true)
  }

  /**
   * Get array of all dates in this range (excluding check-out day)
   *
   * Useful for iterating over each night of the stay
   */
  public getDates(): Date[] {
    const dates: Date[] = []
    const current = new Date(this.props.checkIn)

    while (current < this.props.checkOut) {
      dates.push(new Date(current))
      current.setUTCDate(current.getUTCDate() + 1)
    }

    return dates
  }

  /**
   * Format date range as a string
   */
  public toString(): string {
    return `${this.checkIn.toISOString().split('T')[0]} to ${
      this.checkOut.toISOString().split('T')[0]
    } (${this.nights} night${this.nights === 1 ? '' : 's'})`
  }

  // ============================================================================
  // ValueObject Implementation
  // ============================================================================

  /**
   * Compare equality based on check-in and check-out dates
   */
  protected equalityComponents(): Array<any> {
    return [
      this.props.checkIn.getTime(),
      this.props.checkOut.getTime(),
    ]
  }
}

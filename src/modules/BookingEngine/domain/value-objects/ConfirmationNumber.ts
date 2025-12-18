/**
 * ConfirmationNumber Value Object
 *
 * Represents a unique, human-readable confirmation number for reservations.
 *
 * Format: CAMP-YYYY-XXXXXX (e.g., "CAMP-2025-A1B2C3")
 * - Prefix: CAMP
 * - Year: 4-digit year
 * - Suffix: 6 alphanumeric characters
 *
 * Business Rules:
 * - Must be globally unique across all properties
 * - Should be easy to communicate over phone
 * - Generated at reservation creation time
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export interface ConfirmationNumberProps {
  value: string
}

export class ConfirmationNumber extends ValueObject<ConfirmationNumberProps> {
  // Format: CAMP-YYYY-XXXXXX (matches production generator in lib/booking/api.ts)
  private static readonly FORMAT_REGEX = /^CAMP-\d{4}-[A-Z0-9]{6}$/

  private constructor(props: ConfirmationNumberProps) {
    super(props)
  }

  /**
   * Create from existing confirmation number string
   */
  static create(value: string): ConfirmationNumber {
    const normalized = value.trim().toUpperCase()

    if (!this.FORMAT_REGEX.test(normalized)) {
      throw new Error(
        'Invalid confirmation number format. Expected: CAMP-YYYY-XXXXXX (e.g., "CAMP-2025-A1B2C3")'
      )
    }

    return new ConfirmationNumber({ value: normalized })
  }

  /**
   * Generate a new confirmation number
   * Matches the format used by lib/booking/api.ts generateConfirmationNumber()
   */
  static generate(): ConfirmationNumber {
    const year = new Date().getFullYear()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    const value = `CAMP-${year}-${random}`
    return new ConfirmationNumber({ value })
  }

  get value(): string {
    return this.props.value
  }

  /**
   * Get the year part (4-digit year)
   */
  get year(): number {
    const parts = this.value.split('-')
    return parseInt(parts[1] || '0', 10)
  }

  /**
   * Get the suffix part (6 alphanumeric characters)
   */
  get suffix(): string {
    const parts = this.value.split('-')
    return parts[2] || ''
  }

  /**
   * Convert to string (for display)
   */
  override toString(): string {
    return this.value
  }
}

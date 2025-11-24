/**
 * ConfirmationNumber Value Object
 *
 * Represents a unique, human-readable confirmation number for reservations.
 *
 * Format: XXX-NNNNNN (e.g., "RES-123456")
 * - Prefix: 3 uppercase letters
 * - Separator: hyphen
 * - Number: 6 digits
 *
 * Business Rules:
 * - Must be globally unique across all properties
 * - Should be easy to communicate over phone
 * - Avoids ambiguous characters (0/O, 1/I/L)
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export interface ConfirmationNumberProps {
  value: string
}

export class ConfirmationNumber extends ValueObject<ConfirmationNumberProps> {
  private static readonly FORMAT_REGEX = /^[A-Z]{3}-\d{6}$/
  private static readonly DEFAULT_PREFIX = 'RES'

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
        'Invalid confirmation number format. Expected: XXX-NNNNNN (e.g., "RES-123456")'
      )
    }

    return new ConfirmationNumber({ value: normalized })
  }

  /**
   * Generate a new confirmation number
   */
  static generate(prefix: string = this.DEFAULT_PREFIX): ConfirmationNumber {
    const normalizedPrefix = prefix.trim().toUpperCase()

    // Validate prefix is 3 letters
    if (!/^[A-Z]{3}$/.test(normalizedPrefix)) {
      throw new Error('Prefix must be exactly 3 uppercase letters')
    }

    // Generate random 6-digit number
    const randomNumber = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0')

    const value = `${normalizedPrefix}-${randomNumber}`
    return new ConfirmationNumber({ value })
  }

  get value(): string {
    return this.props.value
  }

  /**
   * Get the prefix part (first 3 letters)
   */
  get prefix(): string {
    return this.value.split('-')[0]
  }

  /**
   * Get the number part (last 6 digits)
   */
  get number(): string {
    return this.value.split('-')[1]
  }

  /**
   * Convert to string (for display)
   */
  override toString(): string {
    return this.value
  }
}

/**
 * MoneyAmount Value Object
 *
 * Represents a monetary amount in cents (integer).
 * Enforces business rules around money handling.
 *
 * Business Rules:
 * - Amounts are stored in cents (smallest currency unit)
 * - Cannot be negative
 * - Maximum value: 999,999,999 cents ($9,999,999.99)
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export interface MoneyAmountProps {
  amountInCents: number
}

export class MoneyAmount extends ValueObject<MoneyAmountProps> {
  private static readonly MAX_AMOUNT_CENTS = 999_999_999 // ~$10 million

  private constructor(props: MoneyAmountProps) {
    super(props)
  }

  static create(amountInCents: number): MoneyAmount {
    // Validate non-negative
    if (amountInCents < 0) {
      throw new Error('Money amount cannot be negative')
    }

    // Validate is integer (no fractional cents)
    if (!Number.isInteger(amountInCents)) {
      throw new Error('Money amount must be an integer (cents)')
    }

    // Validate maximum
    if (amountInCents > this.MAX_AMOUNT_CENTS) {
      throw new Error(`Money amount exceeds maximum allowed value`)
    }

    return new MoneyAmount({ amountInCents })
  }

  /**
   * Create from dollar amount (will be converted to cents)
   */
  static fromDollars(dollars: number): MoneyAmount {
    if (dollars < 0) {
      throw new Error('Dollar amount cannot be negative')
    }

    const cents = Math.round(dollars * 100)
    return this.create(cents)
  }

  /**
   * Create zero amount
   */
  static zero(): MoneyAmount {
    return new MoneyAmount({ amountInCents: 0 })
  }

  get amountInCents(): number {
    return this.props.amountInCents
  }

  /**
   * Get amount in dollars (for display)
   */
  get dollars(): number {
    return this.amountInCents / 100
  }

  /**
   * Format as currency string (e.g., "$123.45")
   */
  format(currencySymbol: string = '$'): string {
    const dollars = this.dollars
    return `${currencySymbol}${dollars.toFixed(2)}`
  }

  /**
   * Format as USD string (e.g., "$123.45")
   * Convenience method for policy messages
   */
  formatAsDollars(): string {
    return this.format('$')
  }

  /**
   * Add another money amount
   */
  add(other: MoneyAmount): MoneyAmount {
    return MoneyAmount.create(this.amountInCents + other.amountInCents)
  }

  /**
   * Subtract another money amount
   */
  subtract(other: MoneyAmount): MoneyAmount {
    const result = this.amountInCents - other.amountInCents
    if (result < 0) {
      throw new Error('Cannot subtract more than current amount')
    }
    return MoneyAmount.create(result)
  }

  /**
   * Multiply by a factor
   */
  multiplyBy(factor: number): MoneyAmount {
    if (factor < 0) {
      throw new Error('Multiplication factor cannot be negative')
    }
    const result = Math.round(this.amountInCents * factor)
    return MoneyAmount.create(result)
  }

  /**
   * Check if amount is zero
   */
  isZero(): boolean {
    return this.amountInCents === 0
  }

  /**
   * Check if this amount is greater than another
   */
  isGreaterThan(other: MoneyAmount): boolean {
    return this.amountInCents > other.amountInCents
  }

  /**
   * Check if this amount is less than another
   */
  isLessThan(other: MoneyAmount): boolean {
    return this.amountInCents < other.amountInCents
  }

  /**
   * Check if this amount is greater than or equal to another
   */
  isGreaterThanOrEqual(other: MoneyAmount): boolean {
    return this.amountInCents >= other.amountInCents
  }
}

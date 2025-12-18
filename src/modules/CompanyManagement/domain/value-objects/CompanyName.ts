/**
 * CompanyName Value Object
 *
 * Encapsulates company name with validation.
 * Immutable value object - once created, cannot be modified.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

interface CompanyNameProps {
  value: string
}

export class CompanyName extends ValueObject<CompanyNameProps> {
  private static readonly MIN_LENGTH = 2
  private static readonly MAX_LENGTH = 100

  /**
   * Get the company name value
   */
  get value(): string {
    return this.props.value
  }

  /**
   * Factory method to create a CompanyName
   *
   * @param name - Company name string
   * @returns CompanyName instance
   * @throws Error if validation fails
   */
  public static create(name: string): CompanyName {
    const trimmed = name.trim()

    if (trimmed.length < CompanyName.MIN_LENGTH) {
      throw new Error(
        `Company name must be at least ${CompanyName.MIN_LENGTH} characters`
      )
    }

    if (trimmed.length > CompanyName.MAX_LENGTH) {
      throw new Error(
        `Company name must be at most ${CompanyName.MAX_LENGTH} characters`
      )
    }

    return new CompanyName({ value: trimmed })
  }

  /**
   * Get the display name (same as value)
   */
  public override toString(): string {
    return this.props.value
  }
}

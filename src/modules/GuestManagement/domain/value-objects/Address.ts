/**
 * Address Value Object
 *
 * Encapsulates physical address information.
 * Address is optional - can be null if not provided.
 * If provided, ALL fields must be present (no partial addresses).
 * Immutable value object - once created, cannot be modified.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

interface AddressProps {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface PartialAddressProps {
  street?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export class Address extends ValueObject<AddressProps> {
  /**
   * Get the street address
   */
  get street(): string {
    return this.props.street
  }

  /**
   * Get the city
   */
  get city(): string {
    return this.props.city
  }

  /**
   * Get the state/province
   */
  get state(): string {
    return this.props.state
  }

  /**
   * Get the zip/postal code
   */
  get zipCode(): string {
    return this.props.zipCode
  }

  /**
   * Get the country
   */
  get country(): string {
    return this.props.country
  }

  /**
   * Factory method to create an Address
   *
   * Returns null if no address fields are provided.
   * Throws error if partial address is provided (all or nothing).
   *
   * @param props - Address fields (all or none)
   * @returns Address instance or null if empty
   * @throws Error if partial address provided
   */
  public static create(props: PartialAddressProps): Address | null {
    // Count how many fields were originally provided (before trimming)
    const originalFieldsProvided = [
      props.street,
      props.city,
      props.state,
      props.zipCode,
      props.country,
    ].filter((field) => field !== undefined)

    // No address provided - return null
    if (originalFieldsProvided.length === 0) {
      return null
    }

    // Check if all fields are provided (must be all or none)
    if (originalFieldsProvided.length !== 5) {
      throw new Error('Address must be complete or empty')
    }

    // Trim all fields
    const street = props.street!.trim()
    const city = props.city!.trim()
    const state = props.state!.trim()
    const zipCode = props.zipCode!.trim()
    const country = props.country!.trim()

    // Check if any field is empty after trimming
    if (
      street.length === 0 ||
      city.length === 0 ||
      state.length === 0 ||
      zipCode.length === 0 ||
      country.length === 0
    ) {
      throw new Error('Address fields cannot be empty')
    }

    // All validation passed - create address
    return new Address({
      street,
      city,
      state,
      zipCode,
      country,
    })
  }

  /**
   * Check if address is complete
   *
   * @returns Always true (if Address exists, it's complete)
   */
  public isComplete(): boolean {
    return true
  }

  /**
   * Format address for display
   *
   * @returns Formatted address string
   * @example "123 Main St, Portland, OR 97201, USA"
   */
  public formatForDisplay(): string {
    return `${this.street}, ${this.city}, ${this.state} ${this.zipCode}, ${this.country}`
  }

  /**
   * Check if this address is in the same country as another
   *
   * @param other - Address to compare
   * @returns True if same country (case insensitive)
   */
  public isSameCountry(other: Address): boolean {
    return this.country.toLowerCase() === other.country.toLowerCase()
  }
}

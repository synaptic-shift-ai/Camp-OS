/**
 * PersonName Value Object
 *
 * Encapsulates a person's first and last name with validation and business logic.
 * Immutable value object - once created, cannot be modified.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

interface PersonNameProps {
  firstName: string
  lastName: string
}

export class PersonName extends ValueObject<PersonNameProps> {
  /**
   * Get the first name
   */
  get firstName(): string {
    return this.props.firstName
  }

  /**
   * Get the last name
   */
  get lastName(): string {
    return this.props.lastName
  }

  /**
   * Factory method to create a PersonName
   *
   * @param props - First and last name
   * @returns PersonName instance
   * @throws Error if validation fails
   */
  public static create(props: PersonNameProps): PersonName {
    // Trim whitespace
    const firstName = props.firstName.trim()
    const lastName = props.lastName.trim()

    // Validate first name
    if (firstName.length === 0) {
      throw new Error('First name cannot be empty')
    }

    // Validate last name
    if (lastName.length === 0) {
      throw new Error('Last name cannot be empty')
    }

    return new PersonName({ firstName, lastName })
  }

  /**
   * Get full name in "First Last" format
   *
   * @returns Full name string
   * @example "John Doe"
   */
  public getFullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  /**
   * Get initials in uppercase
   *
   * @returns Initials (e.g., "JD" for "John Doe")
   */
  public getInitials(): string {
    const firstInitial = this.firstName.charAt(0).toUpperCase()
    const lastInitial = this.lastName.charAt(0).toUpperCase()
    return `${firstInitial}${lastInitial}`
  }

  /**
   * Check if name matches a search term
   *
   * Case-insensitive search against first name, last name, or full name.
   *
   * @param searchTerm - Term to search for
   * @returns True if matches
   */
  public matches(searchTerm: string): boolean {
    if (searchTerm === '') {
      return true
    }

    const term = searchTerm.toLowerCase()
    const firstName = this.firstName.toLowerCase()
    const lastName = this.lastName.toLowerCase()
    const fullName = this.getFullName().toLowerCase()

    return (
      firstName.includes(term) ||
      lastName.includes(term) ||
      fullName.includes(term)
    )
  }
}

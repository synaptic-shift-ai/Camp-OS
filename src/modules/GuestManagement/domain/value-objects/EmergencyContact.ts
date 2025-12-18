/**
 * EmergencyContact Value Object
 *
 * Represents emergency contact information for a guest.
 * Immutable value object - once created, cannot be modified.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

interface EmergencyContactProps {
  name: string
  phone: string
  relationship?: string | undefined
}

export class EmergencyContact extends ValueObject<EmergencyContactProps> {
  /**
   * Get the emergency contact's name
   */
  get name(): string {
    return this.props.name
  }

  /**
   * Get the emergency contact's phone number
   */
  get phone(): string {
    return this.props.phone
  }

  /**
   * Get the relationship to the guest (if provided)
   */
  get relationship(): string | undefined {
    return this.props.relationship
  }

  /**
   * Factory method to create EmergencyContact
   *
   * @param props - Emergency contact information
   * @returns EmergencyContact instance
   * @throws Error if validation fails
   */
  public static create(props: EmergencyContactProps): EmergencyContact {
    const name = props.name.trim()
    const phone = props.phone.trim()
    const relationship = props.relationship?.trim()

    if (name.length === 0) {
      throw new Error('Emergency contact name cannot be empty')
    }

    if (phone.length === 0) {
      throw new Error('Emergency contact phone cannot be empty')
    }

    return new EmergencyContact({
      name,
      phone,
      ...(relationship !== undefined &&
        relationship.length > 0 && { relationship }),
    })
  }

  /**
   * Create from persistence format (database row)
   *
   * @param name - Contact name from database
   * @param phone - Contact phone from database
   * @param relationship - Optional relationship
   * @returns EmergencyContact or null if not present
   */
  public static fromPersistence(
    name: string | null,
    phone: string | null,
    relationship?: string | null
  ): EmergencyContact | null {
    if (name === null || phone === null) {
      return null
    }

    try {
      return EmergencyContact.create({
        name,
        phone,
        ...(relationship !== null &&
          relationship !== undefined && { relationship }),
      })
    } catch {
      return null
    }
  }

  /**
   * Convert to persistence format
   *
   * @returns Database column values
   */
  public toPersistence(): {
    emergency_contact_name: string
    emergency_contact_phone: string
    emergency_contact_relationship: string | null
  } {
    return {
      emergency_contact_name: this.props.name,
      emergency_contact_phone: this.props.phone,
      emergency_contact_relationship: this.props.relationship ?? null,
    }
  }

  /**
   * Get a formatted display string
   *
   * @returns Formatted string like "John Doe (555-0100)"
   */
  public override toString(): string {
    const base = `${this.name} (${this.phone})`
    return this.relationship ? `${base} - ${this.relationship}` : base
  }
}

/**
 * ContactInfo Value Object
 *
 * Encapsulates contact information including email, phone, and optional emergency contact.
 * Email is normalized to lowercase for consistency.
 * Immutable value object - once created, cannot be modified.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

interface ContactInfoProps {
  email: string
  phone: string
  emergencyContactName?: string
  emergencyContactPhone?: string
}

export class ContactInfo extends ValueObject<ContactInfoProps> {
  /**
   * Email validation regex
   * Matches standard email format: local@domain.tld
   */
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  /**
   * Get the email address (normalized to lowercase)
   */
  get email(): string {
    return this.props.email
  }

  /**
   * Get the phone number
   */
  get phone(): string {
    return this.props.phone
  }

  /**
   * Get the emergency contact name (if provided)
   */
  get emergencyContactName(): string | undefined {
    return this.props.emergencyContactName
  }

  /**
   * Get the emergency contact phone (if provided)
   */
  get emergencyContactPhone(): string | undefined {
    return this.props.emergencyContactPhone
  }

  /**
   * Factory method to create ContactInfo
   *
   * @param props - Contact information
   * @returns ContactInfo instance
   * @throws Error if validation fails
   */
  public static create(props: ContactInfoProps): ContactInfo {
    // Trim and normalize email
    const email = props.email.trim().toLowerCase()
    const phone = props.phone.trim()

    // Validate email
    if (email.length === 0) {
      throw new Error('Email cannot be empty')
    }

    if (!ContactInfo.EMAIL_REGEX.test(email)) {
      throw new Error('Invalid email format')
    }

    // Validate phone
    if (phone.length === 0) {
      throw new Error('Phone cannot be empty')
    }

    // Handle emergency contact
    let emergencyContactName: string | undefined
    let emergencyContactPhone: string | undefined

    if (props.emergencyContactName !== undefined || props.emergencyContactPhone !== undefined) {
      // Both must be provided together
      if (props.emergencyContactName === undefined) {
        throw new Error('Emergency contact name is required when phone is provided')
      }

      if (props.emergencyContactPhone === undefined) {
        throw new Error('Emergency contact phone is required when name is provided')
      }

      emergencyContactName = props.emergencyContactName.trim()
      emergencyContactPhone = props.emergencyContactPhone.trim()

      // Validate not empty after trimming
      if (emergencyContactName.length === 0) {
        throw new Error('Emergency contact name cannot be empty')
      }

      if (emergencyContactPhone.length === 0) {
        throw new Error('Emergency contact phone cannot be empty')
      }
    }

    return new ContactInfo({
      email,
      phone,
      emergencyContactName,
      emergencyContactPhone,
    })
  }

  /**
   * Check if email is in valid format
   *
   * @returns True if email is valid
   */
  public isEmailValid(): boolean {
    return ContactInfo.EMAIL_REGEX.test(this.email)
  }

  /**
   * Check if emergency contact information is provided
   *
   * @returns True if emergency contact is present
   */
  public hasEmergencyContact(): boolean {
    return (
      this.emergencyContactName !== undefined &&
      this.emergencyContactPhone !== undefined
    )
  }
}

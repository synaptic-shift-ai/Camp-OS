/**
 * InvoiceNumber Value Object
 *
 * Represents a unique invoice number following the format:
 * INV-{PropertyCode}-{YY}-{SequenceNumber}
 *
 * Example: INV-YY-25-00001
 *
 * Business Rules:
 * - Must follow the format pattern
 * - Property code must be 2 uppercase letters
 * - Year must be 2 digits
 * - Sequence must be a positive number
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export interface InvoiceNumberProps {
  propertyCode: string
  year: string
  sequence: number
}

export class InvoiceNumber extends ValueObject<InvoiceNumberProps> {
  private static readonly FORMAT_REGEX = /^INV-([A-Z]{2})-(\d{2})-(\d+)$/

  private constructor(props: InvoiceNumberProps) {
    super(props)
  }

  /**
   * Create invoice number from components
   */
  static create(propertyCode: string, year: string, sequence: number): InvoiceNumber {
    // Validate property code (2 uppercase letters)
    if (!/^[A-Z]{2}$/.test(propertyCode)) {
      throw new Error('Property code must be exactly 2 uppercase letters')
    }

    // Validate year (2 digits)
    if (!/^\d{2}$/.test(year)) {
      throw new Error('Year must be exactly 2 digits')
    }

    // Validate sequence (positive integer)
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new Error('Sequence number must be a positive integer')
    }

    return new InvoiceNumber({ propertyCode, year, sequence })
  }

  /**
   * Parse invoice number from string
   * Example: "INV-YY-25-00001" → { propertyCode: "YY", year: "25", sequence: 1 }
   */
  static parse(invoiceNumberString: string): InvoiceNumber {
    const match = invoiceNumberString.match(this.FORMAT_REGEX)

    if (!match) {
      throw new Error(
        `Invalid invoice number format. Expected: INV-XX-YY-NNNNN, got: ${invoiceNumberString}`
      )
    }

    const [, propertyCode, year, sequenceStr] = match
    const sequence = parseInt(sequenceStr, 10)

    return new InvoiceNumber({ propertyCode, year, sequence })
  }

  /**
   * Get formatted invoice number string
   */
  get value(): string {
    const paddedSequence = this.props.sequence.toString().padStart(5, '0')
    return `INV-${this.props.propertyCode}-${this.props.year}-${paddedSequence}`
  }

  get propertyCode(): string {
    return this.props.propertyCode
  }

  get year(): string {
    return this.props.year
  }

  get sequence(): number {
    return this.props.sequence
  }
}

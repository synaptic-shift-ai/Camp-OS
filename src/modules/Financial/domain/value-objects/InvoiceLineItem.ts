/**
 * InvoiceLineItem Value Object
 *
 * Represents a single line item on an invoice.
 * Embedded value object (not a separate aggregate).
 *
 * Business Rules:
 * - Quantity must be positive
 * - Unit price must be non-negative
 * - Total = quantity * unitPrice (derived, must match)
 */

import { ValueObject } from '@/shared/domain/ValueObject'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'

export interface InvoiceLineItemProps {
  description: string
  quantity: number
  unitPrice: MoneyAmount
}

export class InvoiceLineItem extends ValueObject<InvoiceLineItemProps> {
  private constructor(props: InvoiceLineItemProps) {
    super(props)
  }

  static create(
    description: string,
    quantity: number,
    unitPrice: MoneyAmount
  ): InvoiceLineItem {
    // Validate description
    if (!description || description.trim().length === 0) {
      throw new Error('Line item description cannot be empty')
    }

    // Validate quantity
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Line item quantity must be a positive integer')
    }

    return new InvoiceLineItem({
      description: description.trim(),
      quantity,
      unitPrice,
    })
  }

  get description(): string {
    return this.props.description
  }

  get quantity(): number {
    return this.props.quantity
  }

  get unitPrice(): MoneyAmount {
    return this.props.unitPrice
  }

  /**
   * Calculate total for this line item (quantity * unitPrice)
   */
  get total(): MoneyAmount {
    return this.props.unitPrice.multiplyBy(this.props.quantity)
  }

  /**
   * Convert to plain object for persistence
   */
  override toJSON(): any {
    return {
      description: this.description,
      quantity: this.quantity,
      unitPriceCents: this.unitPrice.amountInCents,
      totalCents: this.total.amountInCents,
    }
  }

  /**
   * Reconstitute from JSON
   */
  static fromJSON(data: Record<string, any>): InvoiceLineItem {
    return new InvoiceLineItem({
      description: data.description,
      quantity: data.quantity,
      unitPrice: MoneyAmount.create(data.unitPriceCents),
    })
  }
}

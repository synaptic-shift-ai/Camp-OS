/**
 * ReservationPricing Value Object
 *
 * Represents the complete pricing and payment state of a reservation.
 * Enforces business rules around deposits, payments, refunds, and balances.
 *
 * Business Rules:
 * - Base amount must be non-negative
 * - Tax amount must be non-negative
 * - Total amount = base + tax
 * - Amount paid cannot exceed total amount
 * - Refunded amount cannot exceed amount paid
 * - Balance due = total - amount paid + amount refunded
 * - All amounts in cents (integer)
 */

import { ValueObject } from '@/shared/domain/ValueObject'

interface ReservationPricingProps {
  baseAmount: number // Amount before tax (in cents)
  taxAmount: number // Tax amount (in cents)
  totalAmount: number // Total amount (base + tax) (in cents)
  amountPaid: number // Amount paid so far (in cents)
  amountRefunded: number // Amount refunded (in cents)
}

export class ReservationPricing extends ValueObject<ReservationPricingProps> {
  private constructor(props: ReservationPricingProps) {
    super(props)
  }

  /**
   * Factory method to create a new pricing (no payments yet)
   *
   * @param baseAmount - Base amount before tax (in cents)
   * @param taxAmount - Tax amount (in cents)
   * @returns ReservationPricing instance
   * @throws Error if validation fails
   */
  public static create(baseAmount: number, taxAmount: number): ReservationPricing {
    ReservationPricing.validateAmounts(baseAmount, taxAmount, 0, 0)

    const totalAmount = baseAmount + taxAmount

    return new ReservationPricing({
      baseAmount,
      taxAmount,
      totalAmount,
      amountPaid: 0,
      amountRefunded: 0,
    })
  }

  /**
   * Factory method to reconstruct pricing from database
   *
   * @param props - All pricing properties
   * @returns ReservationPricing instance
   * @throws Error if validation fails
   */
  public static fromPersistence(props: ReservationPricingProps): ReservationPricing {
    ReservationPricing.validateAmounts(
      props.baseAmount,
      props.taxAmount,
      props.amountPaid,
      props.amountRefunded
    )

    // Validate total matches base + tax
    const calculatedTotal = props.baseAmount + props.taxAmount
    if (props.totalAmount !== calculatedTotal) {
      throw new Error(
        `Total amount (${props.totalAmount}) must equal base (${props.baseAmount}) + tax (${props.taxAmount})`
      )
    }

    return new ReservationPricing(props)
  }

  /**
   * Validate all amounts according to business rules
   */
  private static validateAmounts(
    baseAmount: number,
    taxAmount: number,
    amountPaid: number,
    amountRefunded: number
  ): void {
    // All amounts must be non-negative
    if (baseAmount < 0) {
      throw new Error('Base amount cannot be negative')
    }
    if (taxAmount < 0) {
      throw new Error('Tax amount cannot be negative')
    }
    if (amountPaid < 0) {
      throw new Error('Amount paid cannot be negative')
    }
    if (amountRefunded < 0) {
      throw new Error('Amount refunded cannot be negative')
    }

    // All amounts must be integers (cents)
    if (!Number.isInteger(baseAmount)) {
      throw new Error('Base amount must be an integer (cents)')
    }
    if (!Number.isInteger(taxAmount)) {
      throw new Error('Tax amount must be an integer (cents)')
    }
    if (!Number.isInteger(amountPaid)) {
      throw new Error('Amount paid must be an integer (cents)')
    }
    if (!Number.isInteger(amountRefunded)) {
      throw new Error('Amount refunded must be an integer (cents)')
    }

    const totalAmount = baseAmount + taxAmount

    // Amount paid cannot exceed total
    if (amountPaid > totalAmount) {
      throw new Error(
        `Amount paid (${amountPaid}) cannot exceed total amount (${totalAmount})`
      )
    }

    // Amount refunded cannot exceed amount paid
    if (amountRefunded > amountPaid) {
      throw new Error(
        `Amount refunded (${amountRefunded}) cannot exceed amount paid (${amountPaid})`
      )
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get baseAmount(): number {
    return this.props.baseAmount
  }

  get taxAmount(): number {
    return this.props.taxAmount
  }

  get totalAmount(): number {
    return this.props.totalAmount
  }

  get amountPaid(): number {
    return this.props.amountPaid
  }

  get amountRefunded(): number {
    return this.props.amountRefunded
  }

  /**
   * Calculate the balance due (amount still owed)
   * Balance = total - paid + refunded
   */
  get balanceDue(): number {
    return this.props.totalAmount - this.props.amountPaid + this.props.amountRefunded
  }

  /**
   * Calculate the net payment (paid - refunded)
   */
  get netPayment(): number {
    return this.props.amountPaid - this.props.amountRefunded
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Check if reservation is fully paid
   */
  public isPaidInFull(): boolean {
    return this.balanceDue === 0
  }

  /**
   * Check if reservation has outstanding balance
   */
  public hasOutstandingBalance(): boolean {
    return this.balanceDue > 0
  }

  /**
   * Check if any payments have been made
   */
  public hasPayments(): boolean {
    return this.props.amountPaid > 0
  }

  /**
   * Check if any refunds have been issued
   */
  public hasRefunds(): boolean {
    return this.props.amountRefunded > 0
  }

  /**
   * Record a payment
   *
   * @param amount - Amount paid (in cents)
   * @returns New ReservationPricing with payment recorded
   */
  public recordPayment(amount: number): ReservationPricing {
    if (amount <= 0) {
      throw new Error('Payment amount must be positive')
    }

    if (!Number.isInteger(amount)) {
      throw new Error('Payment amount must be an integer (cents)')
    }

    const newAmountPaid = this.props.amountPaid + amount

    if (newAmountPaid > this.props.totalAmount) {
      throw new Error(
        `Payment of ${amount} would exceed balance due (${this.balanceDue})`
      )
    }

    return new ReservationPricing({
      ...this.props,
      amountPaid: newAmountPaid,
    })
  }

  /**
   * Record a refund
   *
   * @param amount - Amount to refund (in cents)
   * @returns New ReservationPricing with refund recorded
   */
  public recordRefund(amount: number): ReservationPricing {
    if (amount <= 0) {
      throw new Error('Refund amount must be positive')
    }

    if (!Number.isInteger(amount)) {
      throw new Error('Refund amount must be an integer (cents)')
    }

    const newAmountRefunded = this.props.amountRefunded + amount

    if (newAmountRefunded > this.props.amountPaid) {
      throw new Error(
        `Refund of ${amount} would exceed amount paid (${this.props.amountPaid})`
      )
    }

    return new ReservationPricing({
      ...this.props,
      amountRefunded: newAmountRefunded,
    })
  }

  /**
   * Update pricing (e.g., after reservation modification)
   *
   * This creates new pricing while preserving payment/refund history.
   * If new total is less than amount already paid, you may need to issue a refund.
   *
   * @param newBaseAmount - New base amount (in cents)
   * @param newTaxAmount - New tax amount (in cents)
   * @returns New ReservationPricing with updated amounts
   */
  public updatePricing(newBaseAmount: number, newTaxAmount: number): ReservationPricing {
    ReservationPricing.validateAmounts(
      newBaseAmount,
      newTaxAmount,
      this.props.amountPaid,
      this.props.amountRefunded
    )

    const newTotalAmount = newBaseAmount + newTaxAmount

    // Check if the new total would make payments invalid
    if (this.props.amountPaid > newTotalAmount) {
      throw new Error(
        `New total (${newTotalAmount}) cannot be less than amount already paid (${this.props.amountPaid}). Issue a refund first.`
      )
    }

    return new ReservationPricing({
      baseAmount: newBaseAmount,
      taxAmount: newTaxAmount,
      totalAmount: newTotalAmount,
      amountPaid: this.props.amountPaid,
      amountRefunded: this.props.amountRefunded,
    })
  }

  /**
   * Format pricing as a summary string
   */
  public override toString(): string {
    const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`

    return `Total: ${formatCents(this.totalAmount)} (Base: ${formatCents(
      this.baseAmount
    )}, Tax: ${formatCents(this.taxAmount)}) | Paid: ${formatCents(
      this.amountPaid
    )} | Refunded: ${formatCents(this.amountRefunded)} | Balance: ${formatCents(
      this.balanceDue
    )}`
  }

  // ============================================================================
  // ValueObject Implementation
  // ============================================================================

  /**
   * Compare equality based on all pricing components
   */
  protected equalityComponents(): Array<any> {
    return [
      this.props.baseAmount,
      this.props.taxAmount,
      this.props.totalAmount,
      this.props.amountPaid,
      this.props.amountRefunded,
    ]
  }
}

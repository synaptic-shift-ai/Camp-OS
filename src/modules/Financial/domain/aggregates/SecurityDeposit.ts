/**
 * SecurityDeposit Aggregate Root
 *
 * Manages security deposit lifecycle: hold, deduct, release/forfeit.
 * Tracks deductions with reasons and calculates amounts returned to guest.
 *
 * Business Rules:
 * - Deductions cannot exceed deposit amount
 * - Cannot deduct from released deposit
 * - Deduction reason is required
 * - Released amount = deposit - total deductions
 * - Cannot release already released deposit
 * - Cannot forfeit released deposit
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { DepositStatus } from '../value-objects/DepositStatus'
import { SecurityDepositHeld } from '../events/SecurityDepositHeld'
import { SecurityDepositDeducted } from '../events/SecurityDepositDeducted'
import { SecurityDepositReleased } from '../events/SecurityDepositReleased'

/**
 * Deduction record (embedded value object)
 */
export interface DepositDeduction {
  amountCents: number
  reason: string
  deductedAt: Date
  deductedBy: string
}

export interface SecurityDepositProps {
  propertyId: string
  reservationId: string
  depositAmount: MoneyAmount
  deductions: DepositDeduction[]
  releasedAmount: MoneyAmount
  status: DepositStatus
  stripePaymentIntentId: string | null
  heldAt: Date
  releasedAt: Date | null
  forfeitedAt: Date | null
  updatedAt: Date
}

export class SecurityDeposit extends AggregateRoot<string> {
  private props: SecurityDepositProps

  private constructor(
    id: string,
    props: SecurityDepositProps,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt)
    this.props = props
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  /**
   * Hold a security deposit
   */
  static hold(
    id: string,
    propertyId: string,
    reservationId: string,
    depositAmount: MoneyAmount,
    stripePaymentIntentId: string | null
  ): SecurityDeposit {
    const deposit = new SecurityDeposit(id, {
      propertyId,
      reservationId,
      depositAmount,
      deductions: [],
      releasedAmount: MoneyAmount.zero(),
      status: DepositStatus.HELD,
      stripePaymentIntentId,
      heldAt: new Date(),
      releasedAt: null,
      forfeitedAt: null,
      updatedAt: new Date(),
    })

    // Publish domain event
    deposit.addDomainEvent(
      new SecurityDepositHeld(
        deposit.id,
        reservationId,
        depositAmount.amountInCents,
        stripePaymentIntentId
      )
    )

    return deposit
  }

  /**
   * Reconstitute security deposit from database
   */
  static fromPersistence(data: Record<string, any>): SecurityDeposit {
    const depositAmount = MoneyAmount.create(data.deposit_amount_cents)
    const releasedAmount = MoneyAmount.create(data.released_amount_cents)

    const deductions =
      typeof data.deductions === 'string'
        ? JSON.parse(data.deductions)
        : data.deductions

    const props: SecurityDepositProps = {
      propertyId: data.property_id,
      reservationId: data.reservation_id,
      depositAmount,
      deductions,
      releasedAmount,
      status: data.status as DepositStatus,
      stripePaymentIntentId: data.stripe_payment_intent_id,
      heldAt: new Date(data.held_at),
      releasedAt: data.released_at ? new Date(data.released_at) : null,
      forfeitedAt: data.forfeited_at ? new Date(data.forfeited_at) : null,
      updatedAt: new Date(data.updated_at),
    }

    return new SecurityDeposit(
      data.id,
      props,
      new Date(data.created_at),
      new Date(data.updated_at)
    )
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get propertyId(): string {
    return this.props.propertyId
  }

  get reservationId(): string {
    return this.props.reservationId
  }

  get depositAmount(): MoneyAmount {
    return this.props.depositAmount
  }

  get deductions(): DepositDeduction[] {
    return this.props.deductions
  }

  get totalDeductions(): MoneyAmount {
    const totalCents = this.props.deductions.reduce(
      (sum, deduction) => sum + deduction.amountCents,
      0
    )
    return MoneyAmount.create(totalCents)
  }

  get releasedAmount(): MoneyAmount {
    return this.props.releasedAmount
  }

  get status(): DepositStatus {
    return this.props.status
  }

  get stripePaymentIntentId(): string | null {
    return this.props.stripePaymentIntentId
  }

  get heldAt(): Date {
    return this.props.heldAt
  }

  get releasedAt(): Date | null {
    return this.props.releasedAt
  }

  get forfeitedAt(): Date | null {
    return this.props.forfeitedAt
  }

  get domainEvents() {
    return this.getDomainEvents()
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Deduct amount from deposit (for damages, cleaning, etc.)
   */
  deduct(amount: MoneyAmount, reason: string, deductedBy: string): void {
    // Validate not released/forfeited
    if (
      this.status === DepositStatus.FULLY_RELEASED ||
      this.status === DepositStatus.PARTIALLY_RELEASED ||
      this.status === DepositStatus.FORFEITED
    ) {
      throw new Error('Cannot deduct from released or forfeited deposit')
    }

    // Validate reason
    if (!reason || reason.trim().length === 0) {
      throw new Error('Deduction reason is required')
    }

    // Validate amount doesn't exceed available
    const newTotalDeductions = this.totalDeductions.add(amount)
    if (newTotalDeductions.isGreaterThan(this.props.depositAmount)) {
      throw new Error('Deduction amount exceeds available deposit')
    }

    // Record deduction
    const deduction: DepositDeduction = {
      amountCents: amount.amountInCents,
      reason: reason.trim(),
      deductedAt: new Date(),
      deductedBy,
    }

    this.props.deductions.push(deduction)
    this.props.updatedAt = new Date()

    // Publish event
    this.addDomainEvent(
      new SecurityDepositDeducted(
        this.id,
        amount.amountInCents,
        reason.trim(),
        deductedBy
      )
    )
  }

  /**
   * Release deposit back to guest (minus deductions)
   */
  release(): void {
    // Check not already released
    if (
      this.status === DepositStatus.FULLY_RELEASED ||
      this.status === DepositStatus.PARTIALLY_RELEASED
    ) {
      throw new Error('Deposit has already been released')
    }

    // Calculate amount to release (deposit - deductions)
    const amountToRelease = this.props.depositAmount.subtract(this.totalDeductions)
    this.props.releasedAmount = amountToRelease

    // Determine status
    if (this.totalDeductions.isZero()) {
      this.props.status = DepositStatus.FULLY_RELEASED
    } else {
      this.props.status = DepositStatus.PARTIALLY_RELEASED
    }

    this.props.releasedAt = new Date()
    this.props.updatedAt = new Date()

    // Publish event
    this.addDomainEvent(
      new SecurityDepositReleased(
        this.id,
        amountToRelease.amountInCents,
        this.totalDeductions.amountInCents
      )
    )
  }

  /**
   * Forfeit deposit (guest doesn't get it back)
   */
  forfeit(reason: string): void {
    // Cannot forfeit already released deposit
    if (
      this.status === DepositStatus.FULLY_RELEASED ||
      this.status === DepositStatus.PARTIALLY_RELEASED
    ) {
      throw new Error('Cannot forfeit released deposit')
    }

    this.props.status = DepositStatus.FORFEITED
    this.props.forfeitedAt = new Date()
    this.props.updatedAt = new Date()

    // Note: Could add ForfeitedEvent if needed for notifications
  }

  /**
   * Calculate available amount (not yet deducted)
   */
  getAvailableAmount(): MoneyAmount {
    return this.props.depositAmount.subtract(this.totalDeductions)
  }

  /**
   * Check if deposit has been released
   */
  isReleased(): boolean {
    return (
      this.status === DepositStatus.FULLY_RELEASED ||
      this.status === DepositStatus.PARTIALLY_RELEASED
    )
  }

  /**
   * Check if deposit has been forfeited
   */
  isForfeited(): boolean {
    return this.status === DepositStatus.FORFEITED
  }

  // ============================================================================
  // Persistence Methods
  // ============================================================================

  /**
   * Convert to database persistence format
   */
  toPersistence(): Record<string, any> {
    return {
      id: this.id,
      property_id: this.props.propertyId,
      reservation_id: this.props.reservationId,
      deposit_amount_cents: this.props.depositAmount.amountInCents,
      deductions_cents: this.totalDeductions.amountInCents,
      released_amount_cents: this.props.releasedAmount.amountInCents,
      status: this.props.status,
      stripe_payment_intent_id: this.props.stripePaymentIntentId,
      held_at: this.props.heldAt,
      released_at: this.props.releasedAt,
      forfeited_at: this.props.forfeitedAt,
      deductions: JSON.stringify(this.props.deductions),
      created_at: this.createdAt,
      updated_at: this.props.updatedAt,
    }
  }
}

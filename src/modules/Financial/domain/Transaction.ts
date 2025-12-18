/**
 * Transaction Aggregate Root
 *
 * Represents any money movement in/out of the system.
 * Single source of truth for all financial activity.
 *
 * Business Rules:
 * - Amount must be greater than zero
 * - Cannot modify completed transactions (create reversal instead)
 * - Stripe transactions must have payment intent ID when completed
 * - Only completed transactions can be reconciled
 * - Refunds must reference original transaction
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { TransactionType } from './value-objects/TransactionType'
import { PaymentMethod } from './value-objects/PaymentMethod'
import { TransactionStatus } from './value-objects/TransactionStatus'
import { TransactionRecorded } from './events/TransactionRecorded'
import { TransactionCompleted } from './events/TransactionCompleted'
import { TransactionFailed } from './events/TransactionFailed'
import { RefundProcessed } from './events/RefundProcessed'

export interface TransactionProps {
  propertyId: string
  reservationId: string | null
  invoiceId: string | null

  // Transaction details
  type: TransactionType
  amount: MoneyAmount
  currency: string

  // Payment method
  paymentMethod: PaymentMethod
  stripePaymentIntentId: string | null
  stripeRefundId: string | null

  // Status & metadata
  status: TransactionStatus
  processedAt: Date | null
  failureReason: string | null
  notes: string | null

  // Reconciliation
  reconciledAt: Date | null
  reconciledBy: string | null

  // Audit
  createdBy: string
  updatedAt: Date

  // Internal: original transaction ID for refunds
  _originalTransactionId?: string | null
}

export class Transaction extends AggregateRoot<string> {
  private props: TransactionProps

  private constructor(
    id: string,
    props: TransactionProps,
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
   * Create a new transaction
   */
  static create(
    id: string,
    propertyId: string,
    reservationId: string | null,
    type: TransactionType,
    amount: MoneyAmount,
    paymentMethod: PaymentMethod,
    createdBy: string,
    invoiceId: string | null = null,
    notes: string | null = null
  ): Transaction {
    // Validate amount is non-zero
    if (amount.isZero()) {
      throw new Error('Transaction amount must be greater than zero')
    }

    const transaction = new Transaction(id, {
      propertyId,
      reservationId,
      invoiceId,
      type,
      amount,
      currency: 'USD',
      paymentMethod,
      stripePaymentIntentId: null,
      stripeRefundId: null,
      status: TransactionStatus.PENDING,
      processedAt: null,
      failureReason: null,
      notes,
      reconciledAt: null,
      reconciledBy: null,
      createdBy,
      updatedAt: new Date(),
    })

    // Publish domain event
    transaction.addDomainEvent(
      new TransactionRecorded(
        transaction.id,
        propertyId,
        reservationId,
        type,
        amount.amountInCents,
        paymentMethod
      )
    )

    return transaction
  }

  /**
   * Create a refund transaction (convenience method)
   */
  static createRefund(
    id: string,
    propertyId: string,
    reservationId: string | null,
    amount: MoneyAmount,
    paymentMethod: PaymentMethod,
    createdBy: string,
    originalTransactionId: string | null = null,
    notes: string | null = null
  ): Transaction {
    const transaction = Transaction.create(
      id,
      propertyId,
      reservationId,
      TransactionType.REFUND,
      amount,
      paymentMethod,
      createdBy,
      null,
      notes
    )

    // Store original transaction ID for refund tracking
    transaction.props._originalTransactionId = originalTransactionId

    return transaction
  }

  /**
   * Reconstitute transaction from database
   */
  static fromPersistence(data: Record<string, any>): Transaction {
    const amount = MoneyAmount.create(data.amount_cents)

    const props: TransactionProps = {
      propertyId: data.property_id,
      reservationId: data.reservation_id,
      invoiceId: data.invoice_id,
      type: data.type as TransactionType,
      amount,
      currency: data.currency,
      paymentMethod: data.payment_method as PaymentMethod,
      stripePaymentIntentId: data.stripe_payment_intent_id,
      stripeRefundId: data.stripe_refund_id,
      status: data.status as TransactionStatus,
      processedAt: data.processed_at ? new Date(data.processed_at) : null,
      failureReason: data.failure_reason,
      notes: data.notes,
      reconciledAt: data.reconciled_at ? new Date(data.reconciled_at) : null,
      reconciledBy: data.reconciled_by,
      createdBy: data.created_by,
      updatedAt: new Date(data.updated_at),
    }

    return new Transaction(
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

  get reservationId(): string | null {
    return this.props.reservationId
  }

  get invoiceId(): string | null {
    return this.props.invoiceId
  }

  get type(): TransactionType {
    return this.props.type
  }

  get amount(): MoneyAmount {
    return this.props.amount
  }

  get currency(): string {
    return this.props.currency
  }

  get paymentMethod(): PaymentMethod {
    return this.props.paymentMethod
  }

  get stripePaymentIntentId(): string | null {
    return this.props.stripePaymentIntentId
  }

  get stripeRefundId(): string | null {
    return this.props.stripeRefundId
  }

  get status(): TransactionStatus {
    return this.props.status
  }

  get processedAt(): Date | null {
    return this.props.processedAt
  }

  get failureReason(): string | null {
    return this.props.failureReason
  }

  get notes(): string | null {
    return this.props.notes
  }

  get reconciledAt(): Date | null {
    return this.props.reconciledAt
  }

  get reconciledBy(): string | null {
    return this.props.reconciledBy
  }

  get createdBy(): string {
    return this.props.createdBy
  }

  get domainEvents() {
    return this.getDomainEvents()
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Mark transaction as successfully completed
   */
  complete(stripePaymentIntentId: string | null = null): void {
    if (this.status !== TransactionStatus.PENDING) {
      throw new Error('Cannot complete transaction that is not pending')
    }

    this.props.status = TransactionStatus.COMPLETED
    this.props.processedAt = new Date()
    this.props.stripePaymentIntentId = stripePaymentIntentId
    this.props.updatedAt = new Date()

    // Publish completion event
    this.addDomainEvent(
      new TransactionCompleted(
        this.id,
        stripePaymentIntentId,
        this.props.processedAt
      )
    )

    // If this is a refund, publish additional refund event
    if (this.type === TransactionType.REFUND) {
      this.addDomainEvent(
        new RefundProcessed(
          this.id,
          this.props._originalTransactionId || null,
          this.amount.amountInCents,
          stripePaymentIntentId
        )
      )
    }
  }

  /**
   * Mark transaction as failed
   */
  fail(reason: string): void {
    if (this.status !== TransactionStatus.PENDING) {
      throw new Error('Cannot fail transaction that is not pending')
    }

    this.props.status = TransactionStatus.FAILED
    this.props.failureReason = reason
    this.props.updatedAt = new Date()

    // Publish failure event
    this.addDomainEvent(new TransactionFailed(this.id, reason))
  }

  /**
   * Cancel pending transaction
   */
  cancel(): void {
    if (this.status === TransactionStatus.COMPLETED) {
      throw new Error('Cannot cancel completed transaction')
    }

    this.props.status = TransactionStatus.CANCELLED
    this.props.updatedAt = new Date()
  }

  /**
   * Mark transaction as reconciled (for accounting)
   */
  reconcile(reconciledBy: string): void {
    if (this.status !== TransactionStatus.COMPLETED) {
      throw new Error('Can only reconcile completed transactions')
    }

    this.props.reconciledAt = new Date()
    this.props.reconciledBy = reconciledBy
    this.props.updatedAt = new Date()
  }

  /**
   * Check if transaction is completed
   */
  isCompleted(): boolean {
    return this.status === TransactionStatus.COMPLETED
  }

  /**
   * Check if transaction is reconciled
   */
  isReconciled(): boolean {
    return this.reconciledAt !== null
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
      invoice_id: this.props.invoiceId,
      type: this.props.type,
      amount_cents: this.props.amount.amountInCents,
      currency: this.props.currency,
      payment_method: this.props.paymentMethod,
      stripe_payment_intent_id: this.props.stripePaymentIntentId,
      stripe_refund_id: this.props.stripeRefundId,
      status: this.props.status,
      processed_at: this.props.processedAt,
      failure_reason: this.props.failureReason,
      notes: this.props.notes,
      reconciled_at: this.props.reconciledAt,
      reconciled_by: this.props.reconciledBy,
      created_at: this.createdAt,
      created_by: this.props.createdBy,
      updated_at: this.props.updatedAt,
    }
  }
}

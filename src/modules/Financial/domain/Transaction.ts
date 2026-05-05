/**
 * Transaction Aggregate Root
 *
 * Represents any money movement in/out of the system.
 * Single source of truth for all financial activity.
 *
 * Business Rules:
 * - Amount must be greater than zero (except zero-amount payments with guest credit source)
 * - Cannot modify completed transactions (create reversal instead)
 * - Stripe transactions must have payment intent ID when completed
 * - Only completed transactions can be reconciled
 * - Refunds must reference original transaction
 * - Voided transactions cannot be voided again
 * - Recognition status transitions are validated
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { TransactionType } from './value-objects/TransactionType'
import { type PaymentMethod } from './value-objects/PaymentMethod'
import { TransactionStatus } from './value-objects/TransactionStatus'
import { TransactionSource } from './value-objects/TransactionSource'
import { RefundHandling } from './value-objects/RefundHandling'
import { RecognitionStatus } from './value-objects/RecognitionStatus'
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

  // Audit (null when guest / booking-site initiated payment, not staff)
  createdBy: string | null
  updatedAt: Date

  // Stripe webhook idempotency
  processorEventId: string | null

  // Void support
  isVoided: boolean

  // Charge source tracking
  source: TransactionSource

  // Guest linking
  guestId: string | null

  // Refund handling
  handling: RefundHandling | null

  // Charge recognition status
  recognitionStatus: RecognitionStatus

  // Generic processor IDs (processor-agnostic)
  processorPaymentId: string | null
  processorChargeId: string | null
  processorPaymentMethodId: string | null

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
    createdBy: string | null,
    invoiceId: string | null = null,
    notes: string | null = null,
    source: TransactionSource = TransactionSource.RESERVATION,
    processorEventId: string | null = null,
    guestId: string | null = null
  ): Transaction {
    // Validate amount is non-zero, unless it's a guest credit payment
    if (amount.isZero() && !(type === TransactionType.PAYMENT && source === TransactionSource.GUEST_CREDIT)) {
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
      processorEventId,
      isVoided: false,
      source,
      guestId,
      handling: null,
      recognitionStatus: RecognitionStatus.RECOGNIZED,
      processorPaymentId: null,
      processorChargeId: null,
      processorPaymentMethodId: null,
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
      createdBy: (data.created_by as string | null | undefined) ?? null,
      updatedAt: new Date(data.updated_at),
      processorEventId: data.processor_event_id ?? null,
      isVoided: data.is_voided ?? false,
      source: (data.source as TransactionSource) ?? TransactionSource.RESERVATION,
      guestId: data.guest_id ?? null,
      handling: data.handling ? (data.handling as RefundHandling) : null,
      recognitionStatus: (data.recognition_status as RecognitionStatus) ?? RecognitionStatus.RECOGNIZED,
      processorPaymentId: data.processor_payment_id ?? null,
      processorChargeId: data.processor_charge_id ?? null,
      processorPaymentMethodId: data.processor_payment_method_id ?? null,
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

  get createdBy(): string | null {
    return this.props.createdBy
  }

  get domainEvents() {
    return this.getDomainEvents()
  }

  get processorEventId(): string | null {
    return this.props.processorEventId
  }

  get isVoided(): boolean {
    return this.props.isVoided
  }

  get source(): TransactionSource {
    return this.props.source
  }

  get guestId(): string | null {
    return this.props.guestId
  }

  get handling(): RefundHandling | null {
    return this.props.handling
  }

  get recognitionStatus(): RecognitionStatus {
    return this.props.recognitionStatus
  }

  get processorPaymentId(): string | null {
    return this.props.processorPaymentId
  }

  get processorChargeId(): string | null {
    return this.props.processorChargeId
  }

  get processorPaymentMethodId(): string | null {
    return this.props.processorPaymentMethodId
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
   * Void the transaction
   * Marks a completed transaction as voided (e.g., reversed charge, cancelled refund).
   * Cannot void an already-voided transaction.
   */
  void(): void {
    if (this.props.isVoided) {
      throw new Error('Cannot void an already voided transaction')
    }

    this.props.isVoided = true
    this.props.updatedAt = new Date()
  }

  /**
   * Apply a new recognition status with state transition validation.
   *
   * Allowed transitions:
   * - pending → recognized, deferred, written_off
   * - recognized → deferred, written_off
   * - deferred → recognized, written_off
   * - written_off → (terminal, no transitions allowed)
   */
  applyRecognitionStatus(status: RecognitionStatus): void {
    const current = this.props.recognitionStatus

    if (current === status) {
      return // No-op for same status
    }

    const allowedTransitions: Record<RecognitionStatus, RecognitionStatus[]> = {
      [RecognitionStatus.PENDING]: [
        RecognitionStatus.RECOGNIZED,
        RecognitionStatus.DEFERRED,
        RecognitionStatus.WRITTEN_OFF,
      ],
      [RecognitionStatus.RECOGNIZED]: [
        RecognitionStatus.DEFERRED,
        RecognitionStatus.WRITTEN_OFF,
      ],
      [RecognitionStatus.DEFERRED]: [
        RecognitionStatus.RECOGNIZED,
        RecognitionStatus.WRITTEN_OFF,
      ],
      [RecognitionStatus.WRITTEN_OFF]: [],
    }

    if (!allowedTransitions[current].includes(status)) {
      throw new Error(
        `Cannot transition recognition status from ${current} to ${status}`
      )
    }

    this.props.recognitionStatus = status
    this.props.updatedAt = new Date()
  }

  /**
   * Set refund handling method.
   * Can only be set on REFUND type transactions.
   * Value must be a valid RefundHandling enum value or null (to clear).
   */
  setHandling(handling: RefundHandling | null): void {
    if (this.props.type !== TransactionType.REFUND) {
      throw new Error('Handling can only be set on refund-type transactions')
    }

    if (handling !== null && !(Object.values(RefundHandling).includes(handling))) {
      throw new Error(`Invalid refund handling value: ${handling}`)
    }

    this.props.handling = handling
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
      processor_event_id: this.props.processorEventId,
      is_voided: this.props.isVoided,
      source: this.props.source,
      guest_id: this.props.guestId,
      handling: this.props.handling,
      recognition_status: this.props.recognitionStatus,
      processor_payment_id: this.props.processorPaymentId,
      processor_charge_id: this.props.processorChargeId,
      processor_payment_method_id: this.props.processorPaymentMethodId,
    }
  }
}

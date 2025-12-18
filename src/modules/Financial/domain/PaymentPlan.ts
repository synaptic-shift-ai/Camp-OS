/**
 * PaymentPlan Aggregate Root
 *
 * Manages installment payment schedule for long-term reservations.
 * Tracks invoice generation and payment progress.
 *
 * Business Rules:
 * - Must have at least 2 installments
 * - Interval must be at least 1 day
 * - Cannot add more invoices than installments
 * - Can only complete active plans
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { PaymentPlanStatus } from './value-objects/PaymentPlanStatus'
import { PaymentPlanCreated } from './events/PaymentPlanCreated'
import { PaymentPlanCompleted } from './events/PaymentPlanCompleted'

export interface PaymentPlanProps {
  propertyId: string
  reservationId: string
  totalAmount: MoneyAmount
  numberOfInstallments: number
  installmentIntervalDays: number
  startDate: Date
  invoiceIds: string[]
  status: PaymentPlanStatus
  updatedAt: Date
}

export class PaymentPlan extends AggregateRoot<string> {
  private props: PaymentPlanProps

  private constructor(
    id: string,
    props: PaymentPlanProps,
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
   * Create a new payment plan
   */
  static create(
    id: string,
    propertyId: string,
    reservationId: string,
    totalAmount: MoneyAmount,
    numberOfInstallments: number,
    installmentIntervalDays: number,
    startDate: Date
  ): PaymentPlan {
    // Validate installment count
    if (numberOfInstallments < 2) {
      throw new Error('Payment plan must have at least 2 installments')
    }

    // Validate interval
    if (installmentIntervalDays < 1) {
      throw new Error('Installment interval must be at least 1 day')
    }

    const plan = new PaymentPlan(id, {
      propertyId,
      reservationId,
      totalAmount,
      numberOfInstallments,
      installmentIntervalDays,
      startDate,
      invoiceIds: [],
      status: PaymentPlanStatus.ACTIVE,
      updatedAt: new Date(),
    })

    // Publish domain event
    plan.addDomainEvent(
      new PaymentPlanCreated(
        plan.id,
        reservationId,
        numberOfInstallments,
        totalAmount.amountInCents
      )
    )

    return plan
  }

  /**
   * Reconstitute payment plan from database
   */
  static fromPersistence(data: Record<string, any>): PaymentPlan {
    const totalAmount = MoneyAmount.create(data.total_amount_cents)
    const invoiceIds =
      typeof data.invoice_ids === 'string'
        ? JSON.parse(data.invoice_ids)
        : data.invoice_ids

    const props: PaymentPlanProps = {
      propertyId: data.property_id,
      reservationId: data.reservation_id,
      totalAmount,
      numberOfInstallments: data.number_of_installments,
      installmentIntervalDays: data.installment_interval_days,
      startDate: new Date(data.start_date),
      invoiceIds,
      status: data.status as PaymentPlanStatus,
      updatedAt: new Date(data.updated_at),
    }

    return new PaymentPlan(
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

  get totalAmount(): MoneyAmount {
    return this.props.totalAmount
  }

  get numberOfInstallments(): number {
    return this.props.numberOfInstallments
  }

  get installmentIntervalDays(): number {
    return this.props.installmentIntervalDays
  }

  get startDate(): Date {
    return this.props.startDate
  }

  get invoiceIds(): string[] {
    return this.props.invoiceIds
  }

  get status(): PaymentPlanStatus {
    return this.props.status
  }

  get domainEvents() {
    return this.getDomainEvents()
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Add an invoice to the payment plan
   */
  addInvoice(invoiceId: string): void {
    if (this.props.invoiceIds.length >= this.props.numberOfInstallments) {
      throw new Error('Cannot add more invoices than number of installments')
    }

    this.props.invoiceIds.push(invoiceId)
    this.props.updatedAt = new Date()
  }

  /**
   * Mark payment plan as completed (all installments paid)
   */
  complete(): void {
    if (this.status !== PaymentPlanStatus.ACTIVE) {
      throw new Error('Payment plan is not active')
    }

    this.props.status = PaymentPlanStatus.COMPLETED
    this.props.updatedAt = new Date()

    // Publish completion event
    this.addDomainEvent(new PaymentPlanCompleted(this.id, new Date()))
  }

  /**
   * Cancel the payment plan
   */
  cancel(): void {
    this.props.status = PaymentPlanStatus.CANCELLED
    this.props.updatedAt = new Date()
  }

  /**
   * Mark payment plan as defaulted (payment overdue)
   */
  markDefaulted(): void {
    this.props.status = PaymentPlanStatus.DEFAULTED
    this.props.updatedAt = new Date()
  }

  /**
   * Calculate due date for a specific installment number (1-indexed)
   */
  calculateDueDate(installmentNumber: number): Date {
    const daysToAdd = (installmentNumber - 1) * this.props.installmentIntervalDays
    const dueDate = new Date(this.props.startDate)
    dueDate.setDate(dueDate.getDate() + daysToAdd)
    return dueDate
  }

  /**
   * Check if all invoices have been generated
   */
  areAllInvoicesGenerated(): boolean {
    return this.props.invoiceIds.length === this.props.numberOfInstallments
  }

  /**
   * Get next installment number to generate
   */
  getNextInstallmentNumber(): number {
    return this.props.invoiceIds.length + 1
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
      total_amount_cents: this.props.totalAmount.amountInCents,
      number_of_installments: this.props.numberOfInstallments,
      installment_interval_days: this.props.installmentIntervalDays,
      start_date: this.props.startDate,
      invoice_ids: JSON.stringify(this.props.invoiceIds),
      status: this.props.status,
      created_at: this.createdAt,
      updated_at: this.props.updatedAt,
    }
  }
}

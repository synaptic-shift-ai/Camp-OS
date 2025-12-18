/**
 * Invoice Aggregate Root
 *
 * Represents a billing document for a reservation.
 * Tracks line items, tax calculation, payments, and payment status.
 *
 * Business Rules:
 * - Must have at least one line item
 * - Total = subtotal + tax (always balanced)
 * - Balance = total - paid (derived)
 * - Cannot modify issued invoice
 * - Payment cannot exceed balance
 * - Invoice becomes overdue if past due date and not paid
 * - Cannot cancel paid invoice
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { InvoiceNumber } from './value-objects/InvoiceNumber'
import { InvoiceStatus } from './value-objects/InvoiceStatus'
import { InvoiceLineItem } from './value-objects/InvoiceLineItem'
import { InvoiceGenerated } from './events/InvoiceGenerated'
import { InvoiceIssued } from './events/InvoiceIssued'
import { InvoicePaymentReceived } from './events/InvoicePaymentReceived'
import { InvoicePaid } from './events/InvoicePaid'
import { InvoiceOverdue } from './events/InvoiceOverdue'
import { InvoiceCancelled } from './events/InvoiceCancelled'

export interface InvoiceProps {
  propertyId: string
  reservationId: string
  invoiceNumber: InvoiceNumber
  lineItems: InvoiceLineItem[]
  subtotal: MoneyAmount
  tax: MoneyAmount
  total: MoneyAmount
  paidAmount: MoneyAmount
  taxRate: number
  isInstallment: boolean
  installmentNumber: number | null
  installmentTotal: number | null
  dueDate: Date
  status: InvoiceStatus
  issuedAt: Date | null
  paidAt: Date | null
  cancelledAt: Date | null
  updatedAt: Date
}

export class Invoice extends AggregateRoot<string> {
  private props: InvoiceProps

  private constructor(
    id: string,
    props: InvoiceProps,
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
   * Create a new invoice
   */
  static create(
    id: string,
    propertyId: string,
    reservationId: string,
    invoiceNumber: InvoiceNumber,
    lineItems: InvoiceLineItem[],
    taxRate: number,
    dueDate: Date
  ): Invoice {
    // Validate line items
    if (!lineItems || lineItems.length === 0) {
      throw new Error('Invoice must have at least one line item')
    }

    // Validate tax rate
    if (taxRate < 0) {
      throw new Error('Tax rate cannot be negative')
    }

    // Calculate subtotal (sum of all line item totals)
    const subtotal = lineItems.reduce(
      (sum, item) => sum.add(item.total),
      MoneyAmount.zero()
    )

    // Calculate tax
    const taxMultiplier = taxRate / 100
    const tax = subtotal.multiplyBy(taxMultiplier)

    // Calculate total
    const total = subtotal.add(tax)

    const invoice = new Invoice(id, {
      propertyId,
      reservationId,
      invoiceNumber,
      lineItems,
      subtotal,
      tax,
      total,
      paidAmount: MoneyAmount.zero(),
      taxRate,
      isInstallment: false,
      installmentNumber: null,
      installmentTotal: null,
      dueDate,
      status: InvoiceStatus.DRAFT,
      issuedAt: null,
      paidAt: null,
      cancelledAt: null,
      updatedAt: new Date(),
    })

    // Publish domain event
    invoice.addDomainEvent(
      new InvoiceGenerated(
        invoice.id,
        invoiceNumber.value,
        reservationId,
        total.amountInCents,
        dueDate
      )
    )

    return invoice
  }

  /**
   * Create an installment invoice (for payment plans)
   */
  static createInstallment(
    id: string,
    propertyId: string,
    reservationId: string,
    invoiceNumber: InvoiceNumber,
    lineItems: InvoiceLineItem[],
    taxRate: number,
    dueDate: Date,
    installmentNumber: number,
    installmentTotal: number
  ): Invoice {
    const invoice = Invoice.create(
      id,
      propertyId,
      reservationId,
      invoiceNumber,
      lineItems,
      taxRate,
      dueDate
    )

    invoice.props.isInstallment = true
    invoice.props.installmentNumber = installmentNumber
    invoice.props.installmentTotal = installmentTotal

    return invoice
  }

  /**
   * Reconstitute invoice from database
   */
  static fromPersistence(data: Record<string, any>): Invoice {
    const invoiceNumber = InvoiceNumber.parse(data.invoice_number)
    const subtotal = MoneyAmount.create(data.subtotal_cents)
    const tax = MoneyAmount.create(data.tax_cents)
    const total = MoneyAmount.create(data.total_cents)
    const paidAmount = MoneyAmount.create(data.paid_cents)

    // Deserialize line items from JSON
    const lineItemsData = typeof data.line_items === 'string'
      ? JSON.parse(data.line_items)
      : data.line_items
    const lineItems = lineItemsData.map((item: any) => InvoiceLineItem.fromJSON(item))

    const props: InvoiceProps = {
      propertyId: data.property_id,
      reservationId: data.reservation_id,
      invoiceNumber,
      lineItems,
      subtotal,
      tax,
      total,
      paidAmount,
      taxRate: data.tax_rate,
      isInstallment: data.is_installment,
      installmentNumber: data.installment_number,
      installmentTotal: data.installment_total,
      dueDate: new Date(data.due_date),
      status: data.status as InvoiceStatus,
      issuedAt: data.issued_at ? new Date(data.issued_at) : null,
      paidAt: data.paid_at ? new Date(data.paid_at) : null,
      cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : null,
      updatedAt: new Date(data.updated_at),
    }

    return new Invoice(
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

  get invoiceNumber(): InvoiceNumber {
    return this.props.invoiceNumber
  }

  get lineItems(): InvoiceLineItem[] {
    return this.props.lineItems
  }

  get subtotal(): MoneyAmount {
    return this.props.subtotal
  }

  get tax(): MoneyAmount {
    return this.props.tax
  }

  get total(): MoneyAmount {
    return this.props.total
  }

  get paidAmount(): MoneyAmount {
    return this.props.paidAmount
  }

  get balance(): MoneyAmount {
    return this.props.total.subtract(this.props.paidAmount)
  }

  get taxRate(): number {
    return this.props.taxRate
  }

  get isInstallment(): boolean {
    return this.props.isInstallment
  }

  get installmentNumber(): number | null {
    return this.props.installmentNumber
  }

  get installmentTotal(): number | null {
    return this.props.installmentTotal
  }

  get dueDate(): Date {
    return this.props.dueDate
  }

  get status(): InvoiceStatus {
    return this.props.status
  }

  get issuedAt(): Date | null {
    return this.props.issuedAt
  }

  get paidAt(): Date | null {
    return this.props.paidAt
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt
  }

  get domainEvents() {
    return this.getDomainEvents()
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Mark invoice as issued (sent to guest)
   */
  issue(): void {
    if (this.status !== InvoiceStatus.DRAFT) {
      throw new Error('Invoice is not in draft status')
    }

    this.props.status = InvoiceStatus.ISSUED
    this.props.issuedAt = new Date()
    this.props.updatedAt = new Date()

    // Publish event
    this.addDomainEvent(
      new InvoiceIssued(this.id, this.invoiceNumber.value, this.props.issuedAt)
    )
  }

  /**
   * Apply a payment to this invoice
   */
  applyPayment(transactionId: string, amount: MoneyAmount): void {
    // Cannot pay already paid invoice
    if (this.status === InvoiceStatus.PAID) {
      throw new Error('Cannot apply payment to paid invoice')
    }

    // Validate payment doesn't exceed balance
    const newPaidAmount = this.props.paidAmount.add(amount)
    if (newPaidAmount.isGreaterThan(this.props.total)) {
      throw new Error('Payment amount exceeds invoice balance')
    }

    // Update paid amount
    this.props.paidAmount = newPaidAmount
    const newBalance = this.balance

    this.props.updatedAt = new Date()

    // Publish payment received event
    this.addDomainEvent(
      new InvoicePaymentReceived(
        this.id,
        transactionId,
        amount.amountInCents,
        newBalance.amountInCents
      )
    )

    // Check if fully paid
    if (newBalance.isZero()) {
      this.props.status = InvoiceStatus.PAID
      this.props.paidAt = new Date()

      // Publish paid event
      this.addDomainEvent(new InvoicePaid(this.id, this.props.paidAt))
    }
  }

  /**
   * Cancel the invoice
   */
  cancel(): void {
    if (this.status === InvoiceStatus.PAID) {
      throw new Error('Cannot cancel paid invoice')
    }

    this.props.status = InvoiceStatus.CANCELLED
    this.props.cancelledAt = new Date()
    this.props.updatedAt = new Date()

    // Publish event
    this.addDomainEvent(
      new InvoiceCancelled(this.id, this.invoiceNumber.value, this.props.cancelledAt)
    )
  }

  /**
   * Mark invoice as overdue if past due date and not paid
   */
  markOverdueIfNecessary(): void {
    const now = new Date()
    const isPastDue = this.dueDate < now
    const isUnpaid =
      this.status === InvoiceStatus.ISSUED || this.status === InvoiceStatus.DRAFT

    if (isPastDue && isUnpaid) {
      this.props.status = InvoiceStatus.OVERDUE
      this.props.updatedAt = new Date()

      const daysPastDue = this.calculateDaysPastDue()

      // Publish event
      this.addDomainEvent(
        new InvoiceOverdue(
          this.id,
          this.invoiceNumber.value,
          this.balance.amountInCents,
          daysPastDue
        )
      )
    }
  }

  /**
   * Calculate days past due
   */
  calculateDaysPastDue(): number {
    const now = new Date()
    const diffMs = now.getTime() - this.dueDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  /**
   * Check if invoice is fully paid
   */
  isPaid(): boolean {
    return this.status === InvoiceStatus.PAID
  }

  /**
   * Check if invoice is overdue
   */
  isOverdue(): boolean {
    return this.status === InvoiceStatus.OVERDUE
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
      invoice_number: this.props.invoiceNumber.value,
      subtotal_cents: this.props.subtotal.amountInCents,
      tax_cents: this.props.tax.amountInCents,
      total_cents: this.props.total.amountInCents,
      paid_cents: this.props.paidAmount.amountInCents,
      line_items: JSON.stringify(this.props.lineItems.map((item) => item.toJSON())),
      is_installment: this.props.isInstallment,
      installment_number: this.props.installmentNumber,
      installment_total: this.props.installmentTotal,
      due_date: this.props.dueDate,
      status: this.props.status,
      tax_rate: this.props.taxRate,
      issued_at: this.props.issuedAt,
      paid_at: this.props.paidAt,
      cancelled_at: this.props.cancelledAt,
      created_at: this.createdAt,
      updated_at: this.props.updatedAt,
    }
  }
}

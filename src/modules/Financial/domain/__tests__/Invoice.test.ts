/**
 * Invoice Aggregate Unit Tests
 *
 * Tests business rules for invoice generation, payment tracking, and tax calculation.
 * Following TDD methodology (RED phase - tests written first).
 */

import { describe, test, expect } from 'vitest'
import { Invoice } from '../Invoice'
import { InvoiceNumber } from '../value-objects/InvoiceNumber'
import { InvoiceStatus } from '../value-objects/InvoiceStatus'
import { InvoiceLineItem } from '../value-objects/InvoiceLineItem'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { InvoiceGenerated } from '../events/InvoiceGenerated'
import { InvoiceIssued } from '../events/InvoiceIssued'
import { InvoicePaymentReceived } from '../events/InvoicePaymentReceived'
import { InvoicePaid } from '../events/InvoicePaid'
import { InvoiceCancelled } from '../events/InvoiceCancelled'

describe('Invoice', () => {
  const validPropertyId = 'prop-123'
  const validReservationId = 'res-456'
  const invoiceNumber = InvoiceNumber.create('YY', '25', 1)
  const dueDate = new Date('2025-02-01')

  describe('create', () => {
    test('should create invoice with line items and calculate totals correctly', () => {
      const lineItems = [
        InvoiceLineItem.create('Night 1-3 @ $100/night', 3, MoneyAmount.create(10000)),
        InvoiceLineItem.create('Cleaning fee', 1, MoneyAmount.create(5000)),
      ]
      const taxRate = 7.5 // 7.5%

      const invoice = Invoice.create(
        'inv-001',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        taxRate,
        dueDate
      )

      expect(invoice.id).toBe('inv-001')
      expect(invoice.propertyId).toBe(validPropertyId)
      expect(invoice.reservationId).toBe(validReservationId)
      expect(invoice.invoiceNumber.value).toBe('INV-YY-25-00001')
      expect(invoice.status).toBe(InvoiceStatus.DRAFT)
      expect(invoice.isInstallment).toBe(false)

      // Subtotal = $300 + $50 = $350
      expect(invoice.subtotal.amountInCents).toBe(35000)

      // Tax = $350 * 0.075 = $26.25
      expect(invoice.tax.amountInCents).toBe(2625)

      // Total = $350 + $26.25 = $376.25
      expect(invoice.total.amountInCents).toBe(37625)

      // No payments yet
      expect(invoice.paidAmount.amountInCents).toBe(0)
      expect(invoice.balance.amountInCents).toBe(37625)
    })

    test('should publish InvoiceGenerated event on creation', () => {
      const lineItems = [
        InvoiceLineItem.create('Test item', 1, MoneyAmount.create(10000)),
      ]

      const invoice = Invoice.create(
        'inv-002',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0, // No tax
        dueDate
      )

      const events = invoice.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(InvoiceGenerated)

      const event = events[0] as InvoiceGenerated
      expect(event.invoiceId).toBe('inv-002')
      expect(event.invoiceNumber).toBe('INV-YY-25-00001')
      expect(event.reservationId).toBe(validReservationId)
      expect(event.totalCents).toBe(10000)
    })

    test('should create installment invoice with installment details', () => {
      const lineItems = [
        InvoiceLineItem.create('Month 1 rent', 1, MoneyAmount.create(100000)),
      ]

      const invoice = Invoice.createInstallment(
        'inv-003',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate,
        2, // Installment 2 of 6
        6
      )

      expect(invoice.isInstallment).toBe(true)
      expect(invoice.installmentNumber).toBe(2)
      expect(invoice.installmentTotal).toBe(6)
    })

    test('should reject empty line items array', () => {
      expect(() => {
        Invoice.create(
          'inv-004',
          validPropertyId,
          validReservationId,
          invoiceNumber,
          [], // Empty
          0,
          dueDate
        )
      }).toThrow('Invoice must have at least one line item')
    })

    test('should reject negative tax rate', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]

      expect(() => {
        Invoice.create(
          'inv-005',
          validPropertyId,
          validReservationId,
          invoiceNumber,
          lineItems,
          -5, // Negative
          dueDate
        )
      }).toThrow('Tax rate cannot be negative')
    })
  })

  describe('issue', () => {
    test('should mark draft invoice as issued', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-010',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      invoice.issue()

      expect(invoice.status).toBe(InvoiceStatus.ISSUED)
      expect(invoice.issuedAt).toBeInstanceOf(Date)
    })

    test('should publish InvoiceIssued event', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-011',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      invoice.clearDomainEvents()
      invoice.issue()

      const events = invoice.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(InvoiceIssued)
    })

    test('should reject issuing already issued invoice', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-012',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      invoice.issue()

      expect(() => invoice.issue()).toThrow('Invoice is not in draft status')
    })
  })

  describe('applyPayment', () => {
    test('should apply partial payment and update balance', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-020',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      const payment = MoneyAmount.create(5000) // $50 partial payment
      invoice.applyPayment('txn-001', payment)

      expect(invoice.paidAmount.amountInCents).toBe(5000)
      expect(invoice.balance.amountInCents).toBe(5000)
      expect(invoice.status).toBe(InvoiceStatus.DRAFT) // Not fully paid yet
    })

    test('should mark invoice as paid when full payment received', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-021',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      const payment = MoneyAmount.create(10000) // Full payment
      invoice.applyPayment('txn-002', payment)

      expect(invoice.status).toBe(InvoiceStatus.PAID)
      expect(invoice.paidAt).toBeInstanceOf(Date)
      expect(invoice.balance.isZero()).toBe(true)
    })

    test('should publish InvoicePaymentReceived event', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-022',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      invoice.clearDomainEvents()
      const payment = MoneyAmount.create(5000)
      invoice.applyPayment('txn-003', payment)

      const events = invoice.domainEvents
      expect(events.some((e) => e instanceof InvoicePaymentReceived)).toBe(true)

      const event = events.find((e) => e instanceof InvoicePaymentReceived) as InvoicePaymentReceived
      expect(event.invoiceId).toBe('inv-022')
      expect(event.transactionId).toBe('txn-003')
      expect(event.amountCents).toBe(5000)
      expect(event.newBalanceCents).toBe(5000)
    })

    test('should publish InvoicePaid event when fully paid', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-023',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      invoice.clearDomainEvents()
      invoice.applyPayment('txn-004', MoneyAmount.create(10000))

      const events = invoice.domainEvents
      expect(events.some((e) => e instanceof InvoicePaid)).toBe(true)
    })

    test('should reject payment exceeding balance', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-024',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      const overpayment = MoneyAmount.create(15000)
      expect(() => invoice.applyPayment('txn-005', overpayment)).toThrow(
        'Payment amount exceeds invoice balance'
      )
    })

    test('should reject payment to paid invoice', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-025',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      invoice.applyPayment('txn-006', MoneyAmount.create(10000))

      expect(() => invoice.applyPayment('txn-007', MoneyAmount.create(1000))).toThrow(
        'Cannot apply payment to paid invoice'
      )
    })
  })

  describe('cancel', () => {
    test('should cancel unpaid invoice', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-030',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      invoice.cancel()

      expect(invoice.status).toBe(InvoiceStatus.CANCELLED)
      expect(invoice.cancelledAt).toBeInstanceOf(Date)
    })

    test('should publish InvoiceCancelled event', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-031',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      invoice.clearDomainEvents()
      invoice.cancel()

      const events = invoice.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(InvoiceCancelled)
    })

    test('should reject cancelling paid invoice', () => {
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-032',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        dueDate
      )

      invoice.applyPayment('txn-008', MoneyAmount.create(10000))

      expect(() => invoice.cancel()).toThrow('Cannot cancel paid invoice')
    })
  })

  describe('overdue status', () => {
    test('should mark invoice as overdue if past due date and not paid', () => {
      const pastDueDate = new Date('2020-01-01') // Far in the past
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-040',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        pastDueDate
      )

      invoice.issue() // Must be issued first

      invoice.markOverdueIfNecessary()

      expect(invoice.status).toBe(InvoiceStatus.OVERDUE)
    })

    test('should not mark paid invoice as overdue', () => {
      const pastDueDate = new Date('2020-01-01')
      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-041',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        pastDueDate
      )

      invoice.applyPayment('txn-009', MoneyAmount.create(10000)) // Pay it

      invoice.markOverdueIfNecessary()

      expect(invoice.status).toBe(InvoiceStatus.PAID) // Stays paid
    })

    test('should calculate days past due correctly', () => {
      const pastDueDate = new Date()
      pastDueDate.setDate(pastDueDate.getDate() - 10) // 10 days ago

      const lineItems = [
        InvoiceLineItem.create('Test', 1, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-042',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        0,
        pastDueDate
      )

      const daysPastDue = invoice.calculateDaysPastDue()

      expect(daysPastDue).toBeGreaterThanOrEqual(10)
    })
  })

  describe('persistence', () => {
    test('should convert to persistence format', () => {
      const lineItems = [
        InvoiceLineItem.create('Night 1-3', 3, MoneyAmount.create(10000)),
      ]
      const invoice = Invoice.create(
        'inv-050',
        validPropertyId,
        validReservationId,
        invoiceNumber,
        lineItems,
        7.5,
        dueDate
      )

      const persistence = invoice.toPersistence()

      expect(persistence.id).toBe('inv-050')
      expect(persistence.property_id).toBe(validPropertyId)
      expect(persistence.reservation_id).toBe(validReservationId)
      expect(persistence.invoice_number).toBe('INV-YY-25-00001')
      expect(persistence.subtotal_cents).toBe(30000)
      expect(persistence.tax_cents).toBe(2250)
      expect(persistence.total_cents).toBe(32250)
      expect(persistence.paid_cents).toBe(0)
      expect(persistence.tax_rate).toBe(7.5)
      expect(persistence.line_items).toBeDefined()
      expect(persistence.is_installment).toBe(false)
    })

    test('should reconstitute from persistence format', () => {
      const persistenceData = {
        id: 'inv-051',
        property_id: validPropertyId,
        reservation_id: validReservationId,
        invoice_number: 'INV-YY-25-00001',
        subtotal_cents: 10000,
        tax_cents: 750,
        total_cents: 10750,
        paid_cents: 5000,
        line_items: JSON.stringify([
          {
            description: 'Test item',
            quantity: 1,
            unitPriceCents: 10000,
            totalCents: 10000,
          },
        ]),
        is_installment: false,
        installment_number: null,
        installment_total: null,
        due_date: '2025-02-01',
        status: InvoiceStatus.ISSUED,
        tax_rate: 7.5,
        issued_at: new Date('2025-01-15'),
        paid_at: null,
        cancelled_at: null,
        created_at: new Date('2025-01-14'),
        updated_at: new Date('2025-01-15'),
      }

      const invoice = Invoice.fromPersistence(persistenceData)

      expect(invoice.id).toBe('inv-051')
      expect(invoice.total.amountInCents).toBe(10750)
      expect(invoice.paidAmount.amountInCents).toBe(5000)
      expect(invoice.balance.amountInCents).toBe(5750)
      expect(invoice.status).toBe(InvoiceStatus.ISSUED)
      expect(invoice.domainEvents).toHaveLength(0)
    })
  })
})

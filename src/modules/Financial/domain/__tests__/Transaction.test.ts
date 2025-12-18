/**
 * Transaction Aggregate Unit Tests
 *
 * Tests business rules and invariants for financial transactions.
 * Following TDD methodology (RED phase - tests written first).
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { Transaction } from '../Transaction'
import { TransactionType } from '../value-objects/TransactionType'
import { PaymentMethod } from '../value-objects/PaymentMethod'
import { TransactionStatus } from '../value-objects/TransactionStatus'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { TransactionRecorded } from '../events/TransactionRecorded'
import { TransactionCompleted } from '../events/TransactionCompleted'
import { TransactionFailed } from '../events/TransactionFailed'
import { RefundProcessed } from '../events/RefundProcessed'

describe('Transaction', () => {
  const validPropertyId = 'prop-123'
  const validReservationId = 'res-456'
  const validUserId = 'user-789'

  describe('create', () => {
    test('should create a payment transaction with all required fields', () => {
      const amount = MoneyAmount.create(10000) // $100.00
      const transaction = Transaction.create(
        'txn-001',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CREDIT_CARD,
        validUserId
      )

      expect(transaction.id).toBe('txn-001')
      expect(transaction.propertyId).toBe(validPropertyId)
      expect(transaction.reservationId).toBe(validReservationId)
      expect(transaction.type).toBe(TransactionType.PAYMENT)
      expect(transaction.amount.amountInCents).toBe(10000)
      expect(transaction.paymentMethod).toBe(PaymentMethod.CREDIT_CARD)
      expect(transaction.status).toBe(TransactionStatus.PENDING)
      expect(transaction.createdBy).toBe(validUserId)
    })

    test('should create expense transaction without reservation (property-level expense)', () => {
      const amount = MoneyAmount.create(5000) // $50.00
      const transaction = Transaction.create(
        'txn-002',
        validPropertyId,
        null, // No reservation for expenses
        TransactionType.EXPENSE,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      expect(transaction.reservationId).toBeNull()
      expect(transaction.type).toBe(TransactionType.EXPENSE)
    })

    test('should publish TransactionRecorded event on creation', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-003',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.STRIPE,
        validUserId
      )

      const events = transaction.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(TransactionRecorded)

      const event = events[0] as TransactionRecorded
      expect(event.transactionId).toBe('txn-003')
      expect(event.propertyId).toBe(validPropertyId)
      expect(event.reservationId).toBe(validReservationId)
      expect(event.type).toBe(TransactionType.PAYMENT)
      expect(event.amountCents).toBe(10000)
      expect(event.paymentMethod).toBe(PaymentMethod.STRIPE)
    })

    test('should reject zero amount', () => {
      expect(() => {
        Transaction.create(
          'txn-004',
          validPropertyId,
          validReservationId,
          TransactionType.PAYMENT,
          MoneyAmount.zero(),
          PaymentMethod.CASH,
          validUserId
        )
      }).toThrow('Transaction amount must be greater than zero')
    })

    test('should accept optional notes and invoice ID', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-005',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId,
        'inv-001',
        'Payment for first night'
      )

      expect(transaction.invoiceId).toBe('inv-001')
      expect(transaction.notes).toBe('Payment for first night')
    })
  })

  describe('complete', () => {
    test('should mark transaction as completed with processing timestamp', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-010',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.STRIPE,
        validUserId
      )

      const stripePaymentIntentId = 'pi_test123'
      transaction.complete(stripePaymentIntentId)

      expect(transaction.status).toBe(TransactionStatus.COMPLETED)
      expect(transaction.stripePaymentIntentId).toBe(stripePaymentIntentId)
      expect(transaction.processedAt).toBeInstanceOf(Date)
    })

    test('should publish TransactionCompleted event', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-011',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.STRIPE,
        validUserId
      )

      transaction.clearDomainEvents() // Clear creation event
      transaction.complete('pi_test123')

      const events = transaction.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(TransactionCompleted)

      const event = events[0] as TransactionCompleted
      expect(event.transactionId).toBe('txn-011')
      expect(event.stripePaymentIntentId).toBe('pi_test123')
      expect(event.processedAt).toBeInstanceOf(Date)
    })

    test('should allow completing transaction without Stripe ID (cash payment)', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-012',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      transaction.complete(null)

      expect(transaction.status).toBe(TransactionStatus.COMPLETED)
      expect(transaction.stripePaymentIntentId).toBeNull()
    })

    test('should reject completing already completed transaction', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-013',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      transaction.complete(null)

      expect(() => transaction.complete(null)).toThrow(
        'Cannot complete transaction that is not pending'
      )
    })
  })

  describe('fail', () => {
    test('should mark transaction as failed with failure reason', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-020',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CREDIT_CARD,
        validUserId
      )

      const failureReason = 'Card declined - insufficient funds'
      transaction.fail(failureReason)

      expect(transaction.status).toBe(TransactionStatus.FAILED)
      expect(transaction.failureReason).toBe(failureReason)
    })

    test('should publish TransactionFailed event', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-021',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CREDIT_CARD,
        validUserId
      )

      transaction.clearDomainEvents()
      transaction.fail('Payment processor timeout')

      const events = transaction.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(TransactionFailed)

      const event = events[0] as TransactionFailed
      expect(event.transactionId).toBe('txn-021')
      expect(event.failureReason).toBe('Payment processor timeout')
    })

    test('should reject failing already completed transaction', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-022',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      transaction.complete(null)

      expect(() => transaction.fail('Some reason')).toThrow(
        'Cannot fail transaction that is not pending'
      )
    })
  })

  describe('cancel', () => {
    test('should cancel pending transaction', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-030',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.STRIPE,
        validUserId
      )

      transaction.cancel()

      expect(transaction.status).toBe(TransactionStatus.CANCELLED)
    })

    test('should reject cancelling completed transaction', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-031',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      transaction.complete(null)

      expect(() => transaction.cancel()).toThrow(
        'Cannot cancel completed transaction'
      )
    })
  })

  describe('refund business rules', () => {
    test('should create refund transaction linked to original payment', () => {
      const originalAmount = MoneyAmount.create(10000)
      const refundAmount = MoneyAmount.create(5000) // Partial refund

      const refund = Transaction.createRefund(
        'txn-refund-001',
        validPropertyId,
        validReservationId,
        refundAmount,
        PaymentMethod.STRIPE,
        validUserId,
        'txn-original-001', // Original transaction ID
        'Customer cancelled reservation'
      )

      expect(refund.type).toBe(TransactionType.REFUND)
      expect(refund.amount.amountInCents).toBe(5000)
      expect(refund.notes).toContain('Customer cancelled reservation')
    })

    test('should publish RefundProcessed event when refund completes', () => {
      const refundAmount = MoneyAmount.create(10000)
      const refund = Transaction.createRefund(
        'txn-refund-002',
        validPropertyId,
        validReservationId,
        refundAmount,
        PaymentMethod.STRIPE,
        validUserId,
        'txn-original-002',
        'Full refund'
      )

      refund.clearDomainEvents()
      refund.complete('pi_refund123')

      const events = refund.domainEvents
      expect(events).toHaveLength(2) // TransactionCompleted + RefundProcessed

      const refundEvent = events.find((e) => e instanceof RefundProcessed) as RefundProcessed
      expect(refundEvent).toBeDefined()
      expect(refundEvent.transactionId).toBe('txn-refund-002')
      expect(refundEvent.originalTransactionId).toBe('txn-original-002')
      expect(refundEvent.amountCents).toBe(10000)
    })
  })

  describe('reconciliation', () => {
    test('should allow marking transaction as reconciled', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-040',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      transaction.complete(null)

      const reconciledBy = 'admin-001'
      transaction.reconcile(reconciledBy)

      expect(transaction.reconciledAt).toBeInstanceOf(Date)
      expect(transaction.reconciledBy).toBe(reconciledBy)
    })

    test('should reject reconciling non-completed transaction', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-041',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      expect(() => transaction.reconcile('admin-001')).toThrow(
        'Can only reconcile completed transactions'
      )
    })
  })

  describe('persistence', () => {
    test('should convert to persistence format', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-050',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.STRIPE,
        validUserId,
        'inv-001',
        'Test payment'
      )

      transaction.complete('pi_test123')

      const persistence = transaction.toPersistence()

      expect(persistence.id).toBe('txn-050')
      expect(persistence.property_id).toBe(validPropertyId)
      expect(persistence.reservation_id).toBe(validReservationId)
      expect(persistence.invoice_id).toBe('inv-001')
      expect(persistence.type).toBe(TransactionType.PAYMENT)
      expect(persistence.amount_cents).toBe(10000)
      expect(persistence.payment_method).toBe(PaymentMethod.STRIPE)
      expect(persistence.status).toBe(TransactionStatus.COMPLETED)
      expect(persistence.stripe_payment_intent_id).toBe('pi_test123')
      expect(persistence.notes).toBe('Test payment')
      expect(persistence.processed_at).toBeInstanceOf(Date)
      expect(persistence.created_by).toBe(validUserId)
    })

    test('should reconstitute from persistence format', () => {
      const persistenceData = {
        id: 'txn-051',
        property_id: validPropertyId,
        reservation_id: validReservationId,
        invoice_id: 'inv-002',
        type: TransactionType.PAYMENT,
        amount_cents: 15000,
        currency: 'USD',
        payment_method: PaymentMethod.CASH,
        stripe_payment_intent_id: null,
        stripe_refund_id: null,
        status: TransactionStatus.COMPLETED,
        processed_at: new Date('2025-01-15T10:00:00Z'),
        failure_reason: null,
        notes: 'Cash payment at check-in',
        reconciled_at: null,
        reconciled_by: null,
        created_at: new Date('2025-01-15T09:00:00Z'),
        created_by: validUserId,
        updated_at: new Date('2025-01-15T10:00:00Z'),
      }

      const transaction = Transaction.fromPersistence(persistenceData)

      expect(transaction.id).toBe('txn-051')
      expect(transaction.propertyId).toBe(validPropertyId)
      expect(transaction.amount.amountInCents).toBe(15000)
      expect(transaction.status).toBe(TransactionStatus.COMPLETED)
      expect(transaction.notes).toBe('Cash payment at check-in')
      expect(transaction.domainEvents).toHaveLength(0) // Reconstituted aggregates have no events
    })
  })
})

/**
 * Transaction Aggregate Unit Tests
 *
 * Tests business rules and invariants for financial transactions.
 * Following TDD methodology (RED phase - tests written first).
 */

import { describe, test, expect } from 'vitest'
import { Transaction } from '../Transaction'
import { TransactionType } from '../value-objects/TransactionType'
import { PaymentMethod } from '../value-objects/PaymentMethod'
import { TransactionStatus } from '../value-objects/TransactionStatus'
import { TransactionSource } from '../value-objects/TransactionSource'
import { RefundHandling } from '../value-objects/RefundHandling'
import { RecognitionStatus } from '../value-objects/RecognitionStatus'
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

    test('should reject zero amount for non-guest-credit payments', () => {
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

    test('should allow zero amount for guest credit payments', () => {
      const transaction = Transaction.create(
        'txn-gc-001',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        MoneyAmount.zero(),
        PaymentMethod.CASH,
        validUserId,
        null,
        null,
        TransactionSource.GUEST_CREDIT
      )

      expect(transaction.amount.amountInCents).toBe(0)
      expect(transaction.source).toBe(TransactionSource.GUEST_CREDIT)
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

    test('should default source to RESERVATION', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-src-001',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      expect(transaction.source).toBe(TransactionSource.RESERVATION)
    })

    test('should default recognitionStatus to RECOGNIZED', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-rs-001',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      expect(transaction.recognitionStatus).toBe(RecognitionStatus.RECOGNIZED)
    })

    test('should default isVoided to false', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-v-001',
        validPropertyId,
        validReservationId,
        TransactionType.PAYMENT,
        amount,
        PaymentMethod.CASH,
        validUserId
      )

      expect(transaction.isVoided).toBe(false)
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
      const _originalAmount = MoneyAmount.create(10000)
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

  describe('void', () => {
    test('should void a transaction', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-void-001',
        validPropertyId,
        validReservationId,
        TransactionType.CHARGE,
        amount,
        PaymentMethod.STRIPE,
        validUserId
      )

      transaction.complete(null)
      transaction.void()

      expect(transaction.isVoided).toBe(true)
    })

    test('should reject voiding an already voided transaction', () => {
      const amount = MoneyAmount.create(10000)
      const transaction = Transaction.create(
        'txn-void-002',
        validPropertyId,
        validReservationId,
        TransactionType.CHARGE,
        amount,
        PaymentMethod.STRIPE,
        validUserId
      )

      transaction.complete(null)
      transaction.void()

      expect(() => transaction.void()).toThrow(
        'Cannot void an already voided transaction'
      )
    })
  })

  describe('applyRecognitionStatus', () => {
    test('should transition from pending to recognized', () => {
      const transaction = Transaction.create(
        'txn-rs-002',
        validPropertyId,
        validReservationId,
        TransactionType.CHARGE,
        MoneyAmount.create(5000),
        PaymentMethod.STRIPE,
        validUserId,
        null,
        null,
        TransactionSource.MANUAL
      )

      // Override initial recognition status to pending for this test
      transaction['props'].recognitionStatus = RecognitionStatus.PENDING

      transaction.applyRecognitionStatus(RecognitionStatus.RECOGNIZED)
      expect(transaction.recognitionStatus).toBe(RecognitionStatus.RECOGNIZED)
    })

    test('should transition from recognized to deferred', () => {
      const transaction = Transaction.create(
        'txn-rs-003',
        validPropertyId,
        validReservationId,
        TransactionType.CHARGE,
        MoneyAmount.create(5000),
        PaymentMethod.STRIPE,
        validUserId
      )

      transaction.applyRecognitionStatus(RecognitionStatus.DEFERRED)
      expect(transaction.recognitionStatus).toBe(RecognitionStatus.DEFERRED)
    })

    test('should transition from deferred to recognized', () => {
      const transaction = Transaction.create(
        'txn-rs-004',
        validPropertyId,
        validReservationId,
        TransactionType.CHARGE,
        MoneyAmount.create(5000),
        PaymentMethod.STRIPE,
        validUserId
      )

      transaction.applyRecognitionStatus(RecognitionStatus.DEFERRED)
      transaction.applyRecognitionStatus(RecognitionStatus.RECOGNIZED)
      expect(transaction.recognitionStatus).toBe(RecognitionStatus.RECOGNIZED)
    })

    test('should transition to written_off from any non-terminal state', () => {
      const transaction = Transaction.create(
        'txn-rs-005',
        validPropertyId,
        validReservationId,
        TransactionType.CHARGE,
        MoneyAmount.create(5000),
        PaymentMethod.STRIPE,
        validUserId
      )

      transaction.applyRecognitionStatus(RecognitionStatus.WRITTEN_OFF)
      expect(transaction.recognitionStatus).toBe(RecognitionStatus.WRITTEN_OFF)
    })

    test('should reject transition from written_off (terminal state)', () => {
      const transaction = Transaction.create(
        'txn-rs-006',
        validPropertyId,
        validReservationId,
        TransactionType.CHARGE,
        MoneyAmount.create(5000),
        PaymentMethod.STRIPE,
        validUserId
      )

      transaction.applyRecognitionStatus(RecognitionStatus.WRITTEN_OFF)

      expect(() =>
        transaction.applyRecognitionStatus(RecognitionStatus.RECOGNIZED)
      ).toThrow('Cannot transition recognition status from written_off to recognized')
    })

    test('should be no-op when transitioning to same status', () => {
      const transaction = Transaction.create(
        'txn-rs-007',
        validPropertyId,
        validReservationId,
        TransactionType.CHARGE,
        MoneyAmount.create(5000),
        PaymentMethod.STRIPE,
        validUserId
      )

      expect(transaction.recognitionStatus).toBe(RecognitionStatus.RECOGNIZED)
      transaction.applyRecognitionStatus(RecognitionStatus.RECOGNIZED)
      expect(transaction.recognitionStatus).toBe(RecognitionStatus.RECOGNIZED)
    })
  })

  describe('persistence', () => {
    test('should convert to persistence format including new fields', () => {
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
      // New fields
      expect(persistence.processor_event_id).toBeNull()
      expect(persistence.is_voided).toBe(false)
      expect(persistence.source).toBe(TransactionSource.RESERVATION)
      expect(persistence.guest_id).toBeNull()
      expect(persistence.handling).toBeNull()
      expect(persistence.recognition_status).toBe(RecognitionStatus.RECOGNIZED)
    })

    test('should reconstitute from persistence format including new fields', () => {
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
        // New fields
        processor_event_id: 'evt_123',
        is_voided: true,
        source: TransactionSource.MANUAL,
        guest_id: 'guest-abc',
        handling: null,
        recognition_status: RecognitionStatus.PENDING,
      }

      const transaction = Transaction.fromPersistence(persistenceData)

      expect(transaction.id).toBe('txn-051')
      expect(transaction.propertyId).toBe(validPropertyId)
      expect(transaction.amount.amountInCents).toBe(15000)
      expect(transaction.status).toBe(TransactionStatus.COMPLETED)
      expect(transaction.notes).toBe('Cash payment at check-in')
      expect(transaction.domainEvents).toHaveLength(0) // Reconstituted aggregates have no events
      // New fields
      expect(transaction.processorEventId).toBe('evt_123')
      expect(transaction.isVoided).toBe(true)
      expect(transaction.source).toBe(TransactionSource.MANUAL)
      expect(transaction.guestId).toBe('guest-abc')
      expect(transaction.handling).toBeNull()
      expect(transaction.recognitionStatus).toBe(RecognitionStatus.PENDING)
    })

    test('should handle missing new fields gracefully (backward compat)', () => {
      const legacyData = {
        id: 'txn-legacy',
        property_id: validPropertyId,
        reservation_id: validReservationId,
        invoice_id: null,
        type: TransactionType.PAYMENT,
        amount_cents: 10000,
        currency: 'USD',
        payment_method: PaymentMethod.CASH,
        stripe_payment_intent_id: null,
        stripe_refund_id: null,
        status: TransactionStatus.COMPLETED,
        processed_at: new Date('2025-01-15T10:00:00Z'),
        failure_reason: null,
        notes: null,
        reconciled_at: null,
        reconciled_by: null,
        created_at: new Date('2025-01-15T09:00:00Z'),
        created_by: validUserId,
        updated_at: new Date('2025-01-15T10:00:00Z'),
        // No new fields — legacy row
      }

      const transaction = Transaction.fromPersistence(legacyData)

      expect(transaction.processorEventId).toBeNull()
      expect(transaction.isVoided).toBe(false)
      expect(transaction.source).toBe(TransactionSource.RESERVATION)
      expect(transaction.guestId).toBeNull()
      expect(transaction.handling).toBeNull()
      expect(transaction.recognitionStatus).toBe(RecognitionStatus.RECOGNIZED)
    })

    test('should persist refund with handling method', () => {
      const persistenceData = {
        id: 'txn-refund-persist',
        property_id: validPropertyId,
        reservation_id: validReservationId,
        invoice_id: null,
        type: TransactionType.REFUND,
        amount_cents: 5000,
        currency: 'USD',
        payment_method: PaymentMethod.STRIPE,
        stripe_payment_intent_id: null,
        stripe_refund_id: 're_123',
        status: TransactionStatus.COMPLETED,
        processed_at: new Date('2025-01-15T10:00:00Z'),
        failure_reason: null,
        notes: 'Refund to credit',
        reconciled_at: null,
        reconciled_by: null,
        created_at: new Date('2025-01-15T09:00:00Z'),
        created_by: validUserId,
        updated_at: new Date('2025-01-15T10:00:00Z'),
        processor_event_id: null,
        is_voided: false,
        source: TransactionSource.RESERVATION,
        guest_id: null,
        handling: RefundHandling.GUEST_CREDIT,
        recognition_status: RecognitionStatus.RECOGNIZED,
      }

      const transaction = Transaction.fromPersistence(persistenceData)

      expect(transaction.handling).toBe(RefundHandling.GUEST_CREDIT)

      const roundTrip = transaction.toPersistence()
      expect(roundTrip.handling).toBe(RefundHandling.GUEST_CREDIT)
    })
  })
})

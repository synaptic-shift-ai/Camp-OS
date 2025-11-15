/**
 * PaymentPlan Aggregate Unit Tests
 *
 * Tests business rules for installment payment plans.
 * Following TDD methodology (RED phase - tests written first).
 */

import { describe, test, expect } from 'vitest'
import { PaymentPlan } from './PaymentPlan'
import { PaymentPlanStatus } from '../value-objects/PaymentPlanStatus'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { PaymentPlanCreated } from '../events/PaymentPlanCreated'
import { PaymentPlanCompleted } from '../events/PaymentPlanCompleted'

describe('PaymentPlan', () => {
  const validPropertyId = 'prop-123'
  const validReservationId = 'res-456'

  describe('create', () => {
    test('should create payment plan with installment schedule', () => {
      const totalAmount = MoneyAmount.create(600000) // $6000 for 6 months
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-001',
        validPropertyId,
        validReservationId,
        totalAmount,
        6, // 6 installments
        30, // Every 30 days
        startDate
      )

      expect(plan.id).toBe('plan-001')
      expect(plan.propertyId).toBe(validPropertyId)
      expect(plan.reservationId).toBe(validReservationId)
      expect(plan.totalAmount.amountInCents).toBe(600000)
      expect(plan.numberOfInstallments).toBe(6)
      expect(plan.installmentIntervalDays).toBe(30)
      expect(plan.startDate).toEqual(startDate)
      expect(plan.status).toBe(PaymentPlanStatus.ACTIVE)
      expect(plan.invoiceIds).toEqual([])
    })

    test('should publish PaymentPlanCreated event', () => {
      const totalAmount = MoneyAmount.create(600000)
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-002',
        validPropertyId,
        validReservationId,
        totalAmount,
        6,
        30,
        startDate
      )

      const events = plan.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(PaymentPlanCreated)

      const event = events[0] as PaymentPlanCreated
      expect(event.paymentPlanId).toBe('plan-002')
      expect(event.reservationId).toBe(validReservationId)
      expect(event.numberOfInstallments).toBe(6)
      expect(event.totalAmountCents).toBe(600000)
    })

    test('should reject less than 2 installments', () => {
      const totalAmount = MoneyAmount.create(100000)
      const startDate = new Date('2025-02-01')

      expect(() => {
        PaymentPlan.create(
          'plan-003',
          validPropertyId,
          validReservationId,
          totalAmount,
          1, // Only 1 installment
          30,
          startDate
        )
      }).toThrow('Payment plan must have at least 2 installments')
    })

    test('should reject zero or negative interval', () => {
      const totalAmount = MoneyAmount.create(100000)
      const startDate = new Date('2025-02-01')

      expect(() => {
        PaymentPlan.create(
          'plan-004',
          validPropertyId,
          validReservationId,
          totalAmount,
          3,
          0, // Invalid interval
          startDate
        )
      }).toThrow('Installment interval must be at least 1 day')
    })
  })

  describe('addInvoice', () => {
    test('should add invoice ID to plan', () => {
      const totalAmount = MoneyAmount.create(300000)
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-010',
        validPropertyId,
        validReservationId,
        totalAmount,
        3,
        30,
        startDate
      )

      plan.addInvoice('inv-001')
      plan.addInvoice('inv-002')

      expect(plan.invoiceIds).toEqual(['inv-001', 'inv-002'])
    })

    test('should reject adding more invoices than installments', () => {
      const totalAmount = MoneyAmount.create(200000)
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-011',
        validPropertyId,
        validReservationId,
        totalAmount,
        2,
        30,
        startDate
      )

      plan.addInvoice('inv-001')
      plan.addInvoice('inv-002')

      expect(() => plan.addInvoice('inv-003')).toThrow(
        'Cannot add more invoices than number of installments'
      )
    })
  })

  describe('complete', () => {
    test('should mark plan as completed when all invoices paid', () => {
      const totalAmount = MoneyAmount.create(200000)
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-020',
        validPropertyId,
        validReservationId,
        totalAmount,
        2,
        30,
        startDate
      )

      plan.complete()

      expect(plan.status).toBe(PaymentPlanStatus.COMPLETED)
    })

    test('should publish PaymentPlanCompleted event', () => {
      const totalAmount = MoneyAmount.create(200000)
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-021',
        validPropertyId,
        validReservationId,
        totalAmount,
        2,
        30,
        startDate
      )

      plan.clearDomainEvents()
      plan.complete()

      const events = plan.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(PaymentPlanCompleted)
    })

    test('should reject completing already completed plan', () => {
      const totalAmount = MoneyAmount.create(200000)
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-022',
        validPropertyId,
        validReservationId,
        totalAmount,
        2,
        30,
        startDate
      )

      plan.complete()

      expect(() => plan.complete()).toThrow('Payment plan is not active')
    })
  })

  describe('cancel', () => {
    test('should cancel active payment plan', () => {
      const totalAmount = MoneyAmount.create(300000)
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-030',
        validPropertyId,
        validReservationId,
        totalAmount,
        3,
        30,
        startDate
      )

      plan.cancel()

      expect(plan.status).toBe(PaymentPlanStatus.CANCELLED)
    })
  })

  describe('markDefaulted', () => {
    test('should mark plan as defaulted when payment overdue', () => {
      const totalAmount = MoneyAmount.create(300000)
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-040',
        validPropertyId,
        validReservationId,
        totalAmount,
        3,
        30,
        startDate
      )

      plan.markDefaulted()

      expect(plan.status).toBe(PaymentPlanStatus.DEFAULTED)
    })
  })

  describe('calculateNextDueDate', () => {
    test('should calculate next due date based on installment number', () => {
      const startDate = new Date('2025-02-01')
      const totalAmount = MoneyAmount.create(300000)

      const plan = PaymentPlan.create(
        'plan-050',
        validPropertyId,
        validReservationId,
        totalAmount,
        3,
        30,
        startDate
      )

      // First installment: Feb 1
      const firstDue = plan.calculateDueDate(1)
      expect(firstDue.toISOString().substring(0, 10)).toBe('2025-02-01')

      // Second installment: Mar 3 (30 days later)
      const secondDue = plan.calculateDueDate(2)
      expect(secondDue.toISOString().substring(0, 10)).toBe('2025-03-03')

      // Third installment: Apr 1 (60 days from start)
      const thirdDue = plan.calculateDueDate(3)
      expect(thirdDue.toISOString().substring(0, 10)).toBe('2025-04-01')
    })
  })

  describe('persistence', () => {
    test('should convert to persistence format', () => {
      const totalAmount = MoneyAmount.create(600000)
      const startDate = new Date('2025-02-01')

      const plan = PaymentPlan.create(
        'plan-060',
        validPropertyId,
        validReservationId,
        totalAmount,
        6,
        30,
        startDate
      )

      plan.addInvoice('inv-001')
      plan.addInvoice('inv-002')

      const persistence = plan.toPersistence()

      expect(persistence.id).toBe('plan-060')
      expect(persistence.property_id).toBe(validPropertyId)
      expect(persistence.reservation_id).toBe(validReservationId)
      expect(persistence.total_amount_cents).toBe(600000)
      expect(persistence.number_of_installments).toBe(6)
      expect(persistence.installment_interval_days).toBe(30)
      expect(persistence.start_date).toEqual(startDate)
      expect(persistence.status).toBe(PaymentPlanStatus.ACTIVE)
      expect(persistence.invoice_ids).toEqual(JSON.stringify(['inv-001', 'inv-002']))
    })

    test('should reconstitute from persistence format', () => {
      const persistenceData = {
        id: 'plan-061',
        property_id: validPropertyId,
        reservation_id: validReservationId,
        total_amount_cents: 600000,
        number_of_installments: 6,
        installment_interval_days: 30,
        start_date: new Date('2025-02-01'),
        invoice_ids: JSON.stringify(['inv-001', 'inv-002', 'inv-003']),
        status: PaymentPlanStatus.ACTIVE,
        created_at: new Date('2025-01-15'),
        updated_at: new Date('2025-01-20'),
      }

      const plan = PaymentPlan.fromPersistence(persistenceData)

      expect(plan.id).toBe('plan-061')
      expect(plan.totalAmount.amountInCents).toBe(600000)
      expect(plan.numberOfInstallments).toBe(6)
      expect(plan.invoiceIds).toEqual(['inv-001', 'inv-002', 'inv-003'])
      expect(plan.status).toBe(PaymentPlanStatus.ACTIVE)
      expect(plan.domainEvents).toHaveLength(0) // Reconstituted aggregates have no events
    })
  })
})

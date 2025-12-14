/**
 * SecurityDeposit Aggregate Unit Tests
 *
 * Tests business rules for security deposit hold, deduction, and release.
 * Following TDD methodology (RED phase - tests written first).
 */

import { describe, test, expect } from 'vitest'
import { SecurityDeposit } from './SecurityDeposit'
import { DepositStatus } from '../value-objects/DepositStatus'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { SecurityDepositHeld } from '../events/SecurityDepositHeld'
import { SecurityDepositDeducted } from '../events/SecurityDepositDeducted'
import { SecurityDepositReleased } from '../events/SecurityDepositReleased'

describe('SecurityDeposit', () => {
  const validPropertyId = 'prop-123'
  const validReservationId = 'res-456'
  const validUserId = 'user-789'

  describe('hold', () => {
    test('should create held deposit with amount', () => {
      const depositAmount = MoneyAmount.create(50000) // $500 deposit
      const deposit = SecurityDeposit.hold(
        'dep-001',
        validPropertyId,
        validReservationId,
        depositAmount,
        'pi_stripe123'
      )

      expect(deposit.id).toBe('dep-001')
      expect(deposit.propertyId).toBe(validPropertyId)
      expect(deposit.reservationId).toBe(validReservationId)
      expect(deposit.depositAmount.amountInCents).toBe(50000)
      expect(deposit.status).toBe(DepositStatus.HELD)
      expect(deposit.stripePaymentIntentId).toBe('pi_stripe123')
      expect(deposit.totalDeductions.amountInCents).toBe(0)
      expect(deposit.releasedAmount.amountInCents).toBe(0)
      expect(deposit.heldAt).toBeInstanceOf(Date)
    })

    test('should publish SecurityDepositHeld event', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-002',
        validPropertyId,
        validReservationId,
        depositAmount,
        'pi_stripe123'
      )

      const events = deposit.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(SecurityDepositHeld)

      const event = events[0] as SecurityDepositHeld
      expect(event.depositId).toBe('dep-002')
      expect(event.reservationId).toBe(validReservationId)
      expect(event.amountCents).toBe(50000)
      expect(event.stripePaymentIntentId).toBe('pi_stripe123')
    })

    test('should allow holding deposit without Stripe (cash deposit)', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-003',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      expect(deposit.stripePaymentIntentId).toBeNull()
      expect(deposit.status).toBe(DepositStatus.HELD)
    })
  })

  describe('deduct', () => {
    test('should deduct amount from deposit with reason', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-010',
        validPropertyId,
        validReservationId,
        depositAmount,
        'pi_stripe123'
      )

      const deductionAmount = MoneyAmount.create(10000) // $100 deduction
      deposit.deduct(deductionAmount, 'Broken window', validUserId)

      expect(deposit.totalDeductions.amountInCents).toBe(10000)
      expect(deposit.deductions).toHaveLength(1)
      expect(deposit.deductions[0]!.amountCents).toBe(10000)
      expect(deposit.deductions[0]!.reason).toBe('Broken window')
      expect(deposit.deductions[0]!.deductedBy).toBe(validUserId)
    })

    test('should publish SecurityDepositDeducted event', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-011',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      deposit.clearDomainEvents()
      deposit.deduct(MoneyAmount.create(10000), 'Damage fee', validUserId)

      const events = deposit.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(SecurityDepositDeducted)

      const event = events[0] as SecurityDepositDeducted
      expect(event.depositId).toBe('dep-011')
      expect(event.amountCents).toBe(10000)
      expect(event.reason).toBe('Damage fee')
      expect(event.deductedBy).toBe(validUserId)
    })

    test('should allow multiple deductions', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-012',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      deposit.deduct(MoneyAmount.create(10000), 'Damage 1', validUserId)
      deposit.deduct(MoneyAmount.create(5000), 'Damage 2', validUserId)
      deposit.deduct(MoneyAmount.create(15000), 'Damage 3', validUserId)

      expect(deposit.totalDeductions.amountInCents).toBe(30000)
      expect(deposit.deductions).toHaveLength(3)
    })

    test('should reject deduction exceeding deposit amount', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-013',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      const excessiveDeduction = MoneyAmount.create(60000)

      expect(() =>
        deposit.deduct(excessiveDeduction, 'Too much', validUserId)
      ).toThrow('Deduction amount exceeds available deposit')
    })

    test('should reject deduction from released deposit', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-014',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      deposit.release() // Release it first

      expect(() =>
        deposit.deduct(MoneyAmount.create(10000), 'Late deduction', validUserId)
      ).toThrow('Cannot deduct from released or forfeited deposit')
    })

    test('should require deduction reason', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-015',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      expect(() =>
        deposit.deduct(MoneyAmount.create(10000), '', validUserId)
      ).toThrow('Deduction reason is required')
    })
  })

  describe('release', () => {
    test('should release full deposit when no deductions', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-020',
        validPropertyId,
        validReservationId,
        depositAmount,
        'pi_stripe123'
      )

      deposit.release()

      expect(deposit.status).toBe(DepositStatus.FULLY_RELEASED)
      expect(deposit.releasedAmount.amountInCents).toBe(50000)
      expect(deposit.releasedAt).toBeInstanceOf(Date)
    })

    test('should release partial amount after deductions', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-021',
        validPropertyId,
        validReservationId,
        depositAmount,
        'pi_stripe123'
      )

      deposit.deduct(MoneyAmount.create(15000), 'Cleaning fee', validUserId)
      deposit.release()

      expect(deposit.status).toBe(DepositStatus.PARTIALLY_RELEASED)
      expect(deposit.releasedAmount.amountInCents).toBe(35000) // $500 - $150 = $350
      expect(deposit.totalDeductions.amountInCents).toBe(15000)
    })

    test('should publish SecurityDepositReleased event', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-022',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      deposit.clearDomainEvents()
      deposit.release()

      const events = deposit.domainEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(SecurityDepositReleased)

      const event = events[0] as SecurityDepositReleased
      expect(event.depositId).toBe('dep-022')
      expect(event.releasedAmountCents).toBe(50000)
      expect(event.deductionsCents).toBe(0)
    })

    test('should reject releasing already released deposit', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-023',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      deposit.release()

      expect(() => deposit.release()).toThrow('Deposit has already been released')
    })
  })

  describe('forfeit', () => {
    test('should forfeit entire deposit', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-030',
        validPropertyId,
        validReservationId,
        depositAmount,
        'pi_stripe123'
      )

      deposit.forfeit('Guest caused extensive damage')

      expect(deposit.status).toBe(DepositStatus.FORFEITED)
      expect(deposit.releasedAmount.isZero()).toBe(true)
      expect(deposit.forfeitedAt).toBeInstanceOf(Date)
    })

    test('should reject forfeiting already released deposit', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-031',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      deposit.release()

      expect(() => deposit.forfeit('Too late')).toThrow(
        'Cannot forfeit released deposit'
      )
    })
  })

  describe('calculations', () => {
    test('should calculate available amount correctly', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-040',
        validPropertyId,
        validReservationId,
        depositAmount,
        null
      )

      expect(deposit.getAvailableAmount().amountInCents).toBe(50000)

      deposit.deduct(MoneyAmount.create(10000), 'Fee 1', validUserId)
      expect(deposit.getAvailableAmount().amountInCents).toBe(40000)

      deposit.deduct(MoneyAmount.create(5000), 'Fee 2', validUserId)
      expect(deposit.getAvailableAmount().amountInCents).toBe(35000)
    })
  })

  describe('persistence', () => {
    test('should convert to persistence format', () => {
      const depositAmount = MoneyAmount.create(50000)
      const deposit = SecurityDeposit.hold(
        'dep-050',
        validPropertyId,
        validReservationId,
        depositAmount,
        'pi_stripe123'
      )

      deposit.deduct(MoneyAmount.create(10000), 'Damage', validUserId)
      deposit.release()

      const persistence = deposit.toPersistence()

      expect(persistence.id).toBe('dep-050')
      expect(persistence.property_id).toBe(validPropertyId)
      expect(persistence.reservation_id).toBe(validReservationId)
      expect(persistence.deposit_amount_cents).toBe(50000)
      expect(persistence.deductions_cents).toBe(10000)
      expect(persistence.released_amount_cents).toBe(40000)
      expect(persistence.status).toBe(DepositStatus.PARTIALLY_RELEASED)
      expect(persistence.stripe_payment_intent_id).toBe('pi_stripe123')
      expect(persistence.deductions).toBeDefined()
      expect(persistence.held_at).toBeInstanceOf(Date)
      expect(persistence.released_at).toBeInstanceOf(Date)
    })

    test('should reconstitute from persistence format', () => {
      const heldAt = new Date('2025-01-15T10:00:00Z')
      const releasedAt = new Date('2025-01-20T15:00:00Z')

      const persistenceData = {
        id: 'dep-051',
        property_id: validPropertyId,
        reservation_id: validReservationId,
        deposit_amount_cents: 50000,
        deductions_cents: 15000,
        released_amount_cents: 35000,
        status: DepositStatus.PARTIALLY_RELEASED,
        stripe_payment_intent_id: 'pi_stripe123',
        held_at: heldAt,
        released_at: releasedAt,
        forfeited_at: null,
        deductions: JSON.stringify([
          {
            amountCents: 10000,
            reason: 'Cleaning',
            deductedAt: new Date('2025-01-20T12:00:00Z'),
            deductedBy: validUserId,
          },
          {
            amountCents: 5000,
            reason: 'Minor damage',
            deductedAt: new Date('2025-01-20T14:00:00Z'),
            deductedBy: validUserId,
          },
        ]),
        created_at: new Date('2025-01-15'),
        updated_at: new Date('2025-01-20'),
      }

      const deposit = SecurityDeposit.fromPersistence(persistenceData)

      expect(deposit.id).toBe('dep-051')
      expect(deposit.depositAmount.amountInCents).toBe(50000)
      expect(deposit.totalDeductions.amountInCents).toBe(15000)
      expect(deposit.releasedAmount.amountInCents).toBe(35000)
      expect(deposit.status).toBe(DepositStatus.PARTIALLY_RELEASED)
      expect(deposit.deductions).toHaveLength(2)
      expect(deposit.domainEvents).toHaveLength(0) // Reconstituted aggregates have no events
    })
  })
})

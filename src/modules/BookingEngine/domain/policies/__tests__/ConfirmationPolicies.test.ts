/**
 * Confirmation Policy Tests
 *
 * Tests for the confirmation policy implementations.
 * Verifies that payment validation is correctly enforced by policies.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { FullPaymentPolicy } from '../implementations/FullPaymentPolicy'
import { MinimumDepositPolicy } from '../implementations/MinimumDepositPolicy'
import { NoPaymentPolicy } from '../implementations/NoPaymentPolicy'
import { Reservation } from '../../Reservation'
import { MoneyAmount } from '../../value-objects/MoneyAmount'
import { DateRange } from '../../value-objects/DateRange'
import { OccupancyInfo } from '../../value-objects/OccupancyInfo'
import { ConfirmationNumber } from '../../value-objects/ConfirmationNumber'
import type { ConfirmationContext } from '../IConfirmationPolicy'

// Helper to create test reservations
const createTestReservation = (
  totalAmountDollars: number,
  paidAmountDollars: number
): Reservation => {
  const checkIn = new Date()
  checkIn.setDate(checkIn.getDate() + 7)
  const checkOut = new Date(checkIn)
  checkOut.setDate(checkOut.getDate() + 3)

  const reservation = Reservation.create(
    crypto.randomUUID(),
    'property-123',
    'site-123',
    'guest-123',
    ConfirmationNumber.generate(),
    DateRange.create(checkIn, checkOut),
    OccupancyInfo.create(2, 0, 0, 1),
    MoneyAmount.fromDollars(totalAmountDollars)
  )

  if (paidAmountDollars > 0) {
    reservation.receivePayment(MoneyAmount.fromDollars(paidAmountDollars), 'credit_card')
  }

  return reservation
}

describe('FullPaymentPolicy', () => {
  let policy: FullPaymentPolicy

  beforeEach(() => {
    policy = new FullPaymentPolicy()
  })

  test('should have correct policy type', () => {
    expect(policy.policyType).toBe('full_payment')
  })

  test('should reject when no payment received', () => {
    const reservation = createTestReservation(300, 0)
    const context: ConfirmationContext = { reservation }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.code).toBe('NO_PAYMENT_RECEIVED')
      expect(result.minimumRequired?.amountInCents).toBe(30000)
    }
  })

  test('should reject when partially paid', () => {
    const reservation = createTestReservation(300, 150)
    const context: ConfirmationContext = { reservation }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.code).toBe('INSUFFICIENT_PAYMENT')
      expect(result.reason).toContain('$150.00')
    }
  })

  test('should allow when fully paid', () => {
    const reservation = createTestReservation(300, 300)
    const context: ConfirmationContext = { reservation }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(true)
  })

  test('should allow admin override without payment', () => {
    const reservation = createTestReservation(300, 0)
    const context: ConfirmationContext = {
      reservation,
      isAdminOverride: true,
    }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(true)
  })

  test('should describe policy correctly', () => {
    expect(policy.describe()).toContain('100%')
  })
})

describe('MinimumDepositPolicy', () => {
  test('should have correct policy type', () => {
    const policy = new MinimumDepositPolicy()
    expect(policy.policyType).toBe('minimum_deposit')
  })

  test('should default to 25% deposit', () => {
    const policy = new MinimumDepositPolicy()
    expect(policy.depositPercent).toBe(25)
  })

  test('should accept custom deposit percentage', () => {
    const policy = new MinimumDepositPolicy({ minimumDepositPercent: 50 })
    expect(policy.depositPercent).toBe(50)
  })

  test('should reject invalid deposit percentage', () => {
    expect(() => new MinimumDepositPolicy({ minimumDepositPercent: -10 })).toThrow()
    expect(() => new MinimumDepositPolicy({ minimumDepositPercent: 150 })).toThrow()
  })

  test('should reject when below minimum deposit (25%)', () => {
    const policy = new MinimumDepositPolicy({ minimumDepositPercent: 25 })
    const reservation = createTestReservation(400, 50) // 12.5% paid
    const context: ConfirmationContext = { reservation }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.code).toBe('BELOW_MINIMUM_DEPOSIT')
      expect(result.minimumRequired?.amountInCents).toBe(10000) // 25% of $400 = $100
    }
  })

  test('should allow when minimum deposit met (25%)', () => {
    const policy = new MinimumDepositPolicy({ minimumDepositPercent: 25 })
    const reservation = createTestReservation(400, 100) // Exactly 25%
    const context: ConfirmationContext = { reservation }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(true)
  })

  test('should allow when more than minimum deposit paid', () => {
    const policy = new MinimumDepositPolicy({ minimumDepositPercent: 25 })
    const reservation = createTestReservation(400, 200) // 50% paid
    const context: ConfirmationContext = { reservation }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(true)
  })

  test('should allow admin override without deposit', () => {
    const policy = new MinimumDepositPolicy({ minimumDepositPercent: 50 })
    const reservation = createTestReservation(400, 0)
    const context: ConfirmationContext = {
      reservation,
      isAdminOverride: true,
    }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(true)
  })

  test('should describe policy with percentage', () => {
    const policy = new MinimumDepositPolicy({ minimumDepositPercent: 30 })
    expect(policy.describe()).toContain('30%')
  })

  test('should round up deposit calculation', () => {
    // $333 total, 25% = $83.25, should round up to $84
    const policy = new MinimumDepositPolicy({ minimumDepositPercent: 25 })
    const reservation = createTestReservation(333, 83) // $83 paid

    const result = policy.canConfirm({ reservation })

    // $83 < $83.25 (ceiling) = $84, so should fail
    expect(result.allowed).toBe(false)
  })
})

describe('NoPaymentPolicy', () => {
  let policy: NoPaymentPolicy

  beforeEach(() => {
    policy = new NoPaymentPolicy()
  })

  test('should have correct policy type', () => {
    expect(policy.policyType).toBe('no_payment')
  })

  test('should allow with no payment', () => {
    const reservation = createTestReservation(500, 0)
    const context: ConfirmationContext = { reservation }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(true)
  })

  test('should allow with partial payment', () => {
    const reservation = createTestReservation(500, 100)
    const context: ConfirmationContext = { reservation }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(true)
  })

  test('should allow with full payment', () => {
    const reservation = createTestReservation(500, 500)
    const context: ConfirmationContext = { reservation }

    const result = policy.canConfirm(context)

    expect(result.allowed).toBe(true)
  })

  test('should describe policy correctly', () => {
    expect(policy.describe()).toContain('No payment required')
  })
})

describe('Policy Selection', () => {
  test('different policies produce different results for same reservation', () => {
    const reservation = createTestReservation(400, 100) // 25% paid
    const context: ConfirmationContext = { reservation }

    const fullPayment = new FullPaymentPolicy()
    const deposit25 = new MinimumDepositPolicy({ minimumDepositPercent: 25 })
    const deposit50 = new MinimumDepositPolicy({ minimumDepositPercent: 50 })
    const noPayment = new NoPaymentPolicy()

    expect(fullPayment.canConfirm(context).allowed).toBe(false) // Needs 100%
    expect(deposit25.canConfirm(context).allowed).toBe(true)    // Has 25%
    expect(deposit50.canConfirm(context).allowed).toBe(false)   // Needs 50%
    expect(noPayment.canConfirm(context).allowed).toBe(true)    // No requirement
  })
})

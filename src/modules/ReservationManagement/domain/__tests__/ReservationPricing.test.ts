/**
 * ReservationPricing Value Object Tests
 *
 * Following CLAUDE.md testing best practices:
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterize test inputs
 * - T-8: Test description states what expect verifies
 * - T-10: Test edge cases and boundaries
 */

import { describe, test, expect } from 'vitest'
import { ReservationPricing } from '../ReservationPricing'

describe('ReservationPricing', () => {
  // Test data (amounts in cents)
  const baseAmount = 10000 // $100.00
  const taxAmount = 1000 // $10.00
  const totalAmount = 11000 // $110.00

  describe('create', () => {
    test('should create pricing with base and tax amounts', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(pricing.baseAmount).toBe(baseAmount)
      expect(pricing.taxAmount).toBe(taxAmount)
      expect(pricing.totalAmount).toBe(totalAmount)
      expect(pricing.amountPaid).toBe(0)
      expect(pricing.amountRefunded).toBe(0)
      expect(pricing.balanceDue).toBe(totalAmount)
    })

    test('should create pricing with zero tax', () => {
      const pricing = ReservationPricing.create(baseAmount, 0)

      expect(pricing.baseAmount).toBe(baseAmount)
      expect(pricing.taxAmount).toBe(0)
      expect(pricing.totalAmount).toBe(baseAmount)
    })

    test('should reject negative base amount', () => {
      expect(() => ReservationPricing.create(-1000, taxAmount)).toThrow(
        'Base amount cannot be negative'
      )
    })

    test('should reject negative tax amount', () => {
      expect(() => ReservationPricing.create(baseAmount, -500)).toThrow(
        'Tax amount cannot be negative'
      )
    })

    test('should reject non-integer base amount', () => {
      expect(() => ReservationPricing.create(100.5, taxAmount)).toThrow(
        'Base amount must be an integer (cents)'
      )
    })

    test('should reject non-integer tax amount', () => {
      expect(() => ReservationPricing.create(baseAmount, 10.99)).toThrow(
        'Tax amount must be an integer (cents)'
      )
    })
  })

  describe('fromPersistence', () => {
    test('should reconstruct pricing from all properties', () => {
      const pricing = ReservationPricing.fromPersistence({
        baseAmount,
        taxAmount,
        totalAmount,
        amountPaid: 5000,
        amountRefunded: 1000,
      })

      expect(pricing.baseAmount).toBe(baseAmount)
      expect(pricing.taxAmount).toBe(taxAmount)
      expect(pricing.totalAmount).toBe(totalAmount)
      expect(pricing.amountPaid).toBe(5000)
      expect(pricing.amountRefunded).toBe(1000)
      expect(pricing.balanceDue).toBe(7000) // 11000 - 5000 + 1000
    })

    test('should reject when total does not match base + tax', () => {
      expect(() =>
        ReservationPricing.fromPersistence({
          baseAmount: 10000,
          taxAmount: 1000,
          totalAmount: 12000, // Wrong total
          amountPaid: 0,
          amountRefunded: 0,
        })
      ).toThrow('Total amount (12000) must equal base (10000) + tax (1000)')
    })

    test('should reject when amount paid exceeds total', () => {
      expect(() =>
        ReservationPricing.fromPersistence({
          baseAmount,
          taxAmount,
          totalAmount,
          amountPaid: 15000, // More than total
          amountRefunded: 0,
        })
      ).toThrow('Amount paid (15000) cannot exceed total amount (11000)')
    })

    test('should reject when amount refunded exceeds amount paid', () => {
      expect(() =>
        ReservationPricing.fromPersistence({
          baseAmount,
          taxAmount,
          totalAmount,
          amountPaid: 5000,
          amountRefunded: 6000, // More than paid
        })
      ).toThrow('Amount refunded (6000) cannot exceed amount paid (5000)')
    })
  })

  describe('balanceDue', () => {
    test('should calculate balance for unpaid reservation', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(pricing.balanceDue).toBe(totalAmount)
    })

    test('should calculate balance after partial payment', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )

      expect(pricing.balanceDue).toBe(6000) // 11000 - 5000
    })

    test('should calculate zero balance when fully paid', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        totalAmount
      )

      expect(pricing.balanceDue).toBe(0)
    })

    test('should calculate balance after refund', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(totalAmount)
        .recordRefund(3000)

      expect(pricing.balanceDue).toBe(3000) // 11000 - 11000 + 3000
    })
  })

  describe('netPayment', () => {
    test('should calculate net payment with no refunds', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )

      expect(pricing.netPayment).toBe(5000)
    })

    test('should calculate net payment after refunds', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(10000)
        .recordRefund(3000)

      expect(pricing.netPayment).toBe(7000) // 10000 - 3000
    })

    test('should calculate zero net payment when fully refunded', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(5000)
        .recordRefund(5000)

      expect(pricing.netPayment).toBe(0)
    })
  })

  describe('isPaidInFull', () => {
    test('should return false for unpaid reservation', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(pricing.isPaidInFull()).toBe(false)
    })

    test('should return false for partially paid reservation', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )

      expect(pricing.isPaidInFull()).toBe(false)
    })

    test('should return true when fully paid', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        totalAmount
      )

      expect(pricing.isPaidInFull()).toBe(true)
    })

    test('should return false after partial refund', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(totalAmount)
        .recordRefund(1000)

      expect(pricing.isPaidInFull()).toBe(false)
    })
  })

  describe('hasOutstandingBalance', () => {
    test('should return true for unpaid reservation', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(pricing.hasOutstandingBalance()).toBe(true)
    })

    test('should return false when fully paid', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        totalAmount
      )

      expect(pricing.hasOutstandingBalance()).toBe(false)
    })
  })

  describe('hasPayments', () => {
    test('should return false for new pricing', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(pricing.hasPayments()).toBe(false)
    })

    test('should return true after payment', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        1000
      )

      expect(pricing.hasPayments()).toBe(true)
    })
  })

  describe('hasRefunds', () => {
    test('should return false for new pricing', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(pricing.hasRefunds()).toBe(false)
    })

    test('should return true after refund', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(5000)
        .recordRefund(1000)

      expect(pricing.hasRefunds()).toBe(true)
    })
  })

  describe('recordPayment', () => {
    test('should record full payment', () => {
      const original = ReservationPricing.create(baseAmount, taxAmount)
      const updated = original.recordPayment(totalAmount)

      expect(updated.amountPaid).toBe(totalAmount)
      expect(updated.balanceDue).toBe(0)
      expect(updated.isPaidInFull()).toBe(true)
    })

    test('should record partial payment', () => {
      const original = ReservationPricing.create(baseAmount, taxAmount)
      const updated = original.recordPayment(5000)

      expect(updated.amountPaid).toBe(5000)
      expect(updated.balanceDue).toBe(6000)
    })

    test('should record multiple payments', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(3000)
        .recordPayment(3000)
        .recordPayment(5000)

      expect(pricing.amountPaid).toBe(11000)
      expect(pricing.isPaidInFull()).toBe(true)
    })

    test('should reject zero payment', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(() => pricing.recordPayment(0)).toThrow(
        'Payment amount must be positive'
      )
    })

    test('should reject negative payment', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(() => pricing.recordPayment(-1000)).toThrow(
        'Payment amount must be positive'
      )
    })

    test('should reject non-integer payment', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(() => pricing.recordPayment(100.5)).toThrow(
        'Payment amount must be an integer (cents)'
      )
    })

    test('should reject payment exceeding balance due', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(() => pricing.recordPayment(totalAmount + 1000)).toThrow(
        'Payment of 12000 would exceed balance due (11000)'
      )
    })
  })

  describe('recordRefund', () => {
    test('should record full refund', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(totalAmount)
        .recordRefund(totalAmount)

      expect(pricing.amountRefunded).toBe(totalAmount)
      expect(pricing.balanceDue).toBe(totalAmount)
      expect(pricing.netPayment).toBe(0)
    })

    test('should record partial refund', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(10000)
        .recordRefund(3000)

      expect(pricing.amountRefunded).toBe(3000)
      expect(pricing.balanceDue).toBe(4000) // 11000 - 10000 + 3000
    })

    test('should record multiple refunds', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(totalAmount)
        .recordRefund(2000)
        .recordRefund(3000)

      expect(pricing.amountRefunded).toBe(5000)
      expect(pricing.balanceDue).toBe(5000)
    })

    test('should reject zero refund', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )

      expect(() => pricing.recordRefund(0)).toThrow(
        'Refund amount must be positive'
      )
    })

    test('should reject negative refund', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )

      expect(() => pricing.recordRefund(-1000)).toThrow(
        'Refund amount must be positive'
      )
    })

    test('should reject non-integer refund', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )

      expect(() => pricing.recordRefund(100.5)).toThrow(
        'Refund amount must be an integer (cents)'
      )
    })

    test('should reject refund exceeding amount paid', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )

      expect(() => pricing.recordRefund(6000)).toThrow(
        'Refund of 6000 would exceed amount paid (5000)'
      )
    })
  })

  describe('updatePricing', () => {
    test('should update pricing with higher amount', () => {
      const original = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )
      const updated = original.updatePricing(15000, 1500)

      expect(updated.baseAmount).toBe(15000)
      expect(updated.taxAmount).toBe(1500)
      expect(updated.totalAmount).toBe(16500)
      expect(updated.amountPaid).toBe(5000) // Preserved
      expect(updated.balanceDue).toBe(11500) // 16500 - 5000
    })

    test('should update pricing with lower amount', () => {
      const original = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )
      const updated = original.updatePricing(7000, 700)

      expect(updated.totalAmount).toBe(7700)
      expect(updated.amountPaid).toBe(5000)
      expect(updated.balanceDue).toBe(2700) // 7700 - 5000
    })

    test('should preserve refund history', () => {
      const original = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(10000)
        .recordRefund(2000)

      const updated = original.updatePricing(12000, 1200)

      expect(updated.amountRefunded).toBe(2000) // Preserved
      expect(updated.balanceDue).toBe(5200) // 13200 - 10000 + 2000
    })

    test('should reject update when new total less than amount paid', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        10000
      )

      // The validation catches this in validateAmounts before the custom check
      expect(() => pricing.updatePricing(5000, 500)).toThrow(
        'Amount paid (10000) cannot exceed total amount (5500)'
      )
    })
  })

  describe('toString', () => {
    test('should format unpaid pricing as readable string', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)

      expect(pricing.toString()).toBe(
        'Total: $110.00 (Base: $100.00, Tax: $10.00) | Paid: $0.00 | Refunded: $0.00 | Balance: $110.00'
      )
    })

    test('should format partially paid pricing as readable string', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )

      expect(pricing.toString()).toBe(
        'Total: $110.00 (Base: $100.00, Tax: $10.00) | Paid: $50.00 | Refunded: $0.00 | Balance: $60.00'
      )
    })

    test('should format pricing with refunds as readable string', () => {
      const pricing = ReservationPricing.create(baseAmount, taxAmount)
        .recordPayment(totalAmount)
        .recordRefund(3000)

      expect(pricing.toString()).toBe(
        'Total: $110.00 (Base: $100.00, Tax: $10.00) | Paid: $110.00 | Refunded: $30.00 | Balance: $30.00'
      )
    })
  })

  describe('equality', () => {
    test('should consider two pricing instances with same values as equal', () => {
      const pricing1 = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )
      const pricing2 = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )

      expect(pricing1.equals(pricing2)).toBe(true)
    })

    test('should consider two pricing instances with different base amounts as not equal', () => {
      const pricing1 = ReservationPricing.create(baseAmount, taxAmount)
      const pricing2 = ReservationPricing.create(12000, taxAmount)

      expect(pricing1.equals(pricing2)).toBe(false)
    })

    test('should consider two pricing instances with different payment amounts as not equal', () => {
      const pricing1 = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        5000
      )
      const pricing2 = ReservationPricing.create(baseAmount, taxAmount).recordPayment(
        6000
      )

      expect(pricing1.equals(pricing2)).toBe(false)
    })
  })
})

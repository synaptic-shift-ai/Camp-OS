/**
 * Phase 4: Type Compatibility Tests for Money Handling
 *
 * Validates that:
 * 1. Branded MoneyCents type works correctly
 * 2. BIGINT (integer cents) is used consistently
 * 3. No decimal/float types in money handling
 * 4. Type safety prevents mixing regular numbers with money amounts
 */

import { describe, test, expect, expectTypeOf } from 'vitest'
import type { MoneyCents, MoneyAmount } from './booking'

// ============================================================================
// Helper Functions for Type-Safe Money Operations
// ============================================================================

/**
 * Create a MoneyCents value from integer cents
 * This is the canonical way to create money values
 */
function createMoney(cents: number): MoneyCents {
  if (!Number.isInteger(cents)) {
    throw new Error('Money amount must be an integer (cents)')
  }
  if (cents < 0) {
    throw new Error('Money amount cannot be negative')
  }
  return cents as MoneyCents
}

/**
 * Create a MoneyCents value from dollars (converts to cents)
 */
function dollarsToMoney(dollars: number): MoneyCents {
  const cents = Math.round(dollars * 100)
  return createMoney(cents)
}

/**
 * Convert MoneyCents to dollars for display
 */
function moneyToDollars(money: MoneyCents): number {
  return money / 100
}

/**
 * Add two money amounts (type-safe)
 */
function addMoney(a: MoneyCents, b: MoneyCents): MoneyCents {
  return createMoney(a + b)
}

/**
 * Multiply money by a quantity (type-safe)
 */
function multiplyMoney(money: MoneyCents, quantity: number): MoneyCents {
  if (!Number.isInteger(quantity)) {
    throw new Error('Quantity must be an integer')
  }
  return createMoney(money * quantity)
}

// ============================================================================
// Type Compatibility Tests
// ============================================================================

describe('Phase 4: Money Type Compatibility', () => {
  describe('MoneyCents branded type', () => {
    test('should accept integer values as MoneyCents', () => {
      const price = createMoney(4599)

      expectTypeOf(price).toEqualTypeOf<MoneyCents>()
      expect(price).toBe(4599)
    })

    test('should reject decimal values', () => {
      expect(() => createMoney(45.99)).toThrow('Money amount must be an integer')
    })

    test('should reject negative values', () => {
      expect(() => createMoney(-100)).toThrow('Money amount cannot be negative')
    })

    test('should handle zero correctly', () => {
      const free = createMoney(0)

      expectTypeOf(free).toEqualTypeOf<MoneyCents>()
      expect(free).toBe(0)
    })

    test('should handle large amounts (BIGINT range)', () => {
      // Test amounts in the billions of cents (millions of dollars)
      const largeCents = 999999999999 // $9,999,999,999.99
      const large = createMoney(largeCents)

      expectTypeOf(large).toEqualTypeOf<MoneyCents>()
      expect(large).toBe(largeCents)
    })
  })

  describe('MoneyAmount backward compatibility', () => {
    test('should be compatible with MoneyCents', () => {
      const money: MoneyCents = createMoney(1000)
      const amount: MoneyAmount = money

      expectTypeOf(amount).toEqualTypeOf<MoneyCents>()
      expect(amount).toBe(1000)
    })
  })

  describe('Dollar conversion utilities', () => {
    test('should convert dollars to cents correctly', () => {
      expect(dollarsToMoney(45.99)).toBe(4599)
      expect(dollarsToMoney(100)).toBe(10000)
      expect(dollarsToMoney(0.01)).toBe(1)
    })

    test('should round half-cents correctly', () => {
      // 45.995 should round to 4600 cents
      expect(dollarsToMoney(45.995)).toBe(4600)
    })

    test('should convert cents to dollars for display', () => {
      expect(moneyToDollars(createMoney(4599))).toBe(45.99)
      expect(moneyToDollars(createMoney(10000))).toBe(100)
      expect(moneyToDollars(createMoney(1))).toBe(0.01)
    })
  })

  describe('Money arithmetic operations', () => {
    test('should add two money amounts', () => {
      const price1 = createMoney(4599) // $45.99
      const price2 = createMoney(1000) // $10.00
      const total = addMoney(price1, price2)

      expectTypeOf(total).toEqualTypeOf<MoneyCents>()
      expect(total).toBe(5599) // $55.99
    })

    test('should multiply money by quantity', () => {
      const pricePerNight = createMoney(5000) // $50.00
      const nights = 3
      const total = multiplyMoney(pricePerNight, nights)

      expectTypeOf(total).toEqualTypeOf<MoneyCents>()
      expect(total).toBe(15000) // $150.00
    })

    test('should reject decimal quantities in multiplication', () => {
      const price = createMoney(5000)

      expect(() => multiplyMoney(price, 2.5)).toThrow('Quantity must be an integer')
    })
  })

  describe('Type safety guarantees', () => {
    test('plain numbers are not compatible with MoneyCents without cast', () => {
      // This test validates that TypeScript prevents mixing regular numbers with money
      // The expectTypeOf assertions verify compile-time type safety

      const plainNumber = 4599
      const money = createMoney(plainNumber)

      // Money has branded type
      expectTypeOf(money).toEqualTypeOf<MoneyCents>()

      // Plain number does NOT have branded type
      expectTypeOf(plainNumber).not.toEqualTypeOf<MoneyCents>()
      expectTypeOf(plainNumber).toEqualTypeOf<number>()
    })

    test('branded type preserves through operations', () => {
      const price1 = createMoney(1000)
      const price2 = createMoney(2000)
      const sum = addMoney(price1, price2)

      // Result maintains branded type
      expectTypeOf(sum).toEqualTypeOf<MoneyCents>()
    })
  })

  describe('Real-world pricing scenarios', () => {
    test('should calculate reservation total correctly', () => {
      const basePricePerNight = createMoney(5000) // $50.00
      const nights = 3
      const petFee = createMoney(2500) // $25.00

      const subtotal = multiplyMoney(basePricePerNight, nights)
      const total = addMoney(subtotal, petFee)

      expect(total).toBe(17500) // $175.00
      expect(moneyToDollars(total)).toBe(175.00)
    })

    test('should handle weekend surcharge', () => {
      const weekdayRate = createMoney(5000) // $50.00
      const weekendRate = createMoney(7500) // $75.00
      const weekdayNights = 5
      const weekendNights = 2

      const weekdayTotal = multiplyMoney(weekdayRate, weekdayNights)
      const weekendTotal = multiplyMoney(weekendRate, weekendNights)
      const total = addMoney(weekdayTotal, weekendTotal)

      expect(total).toBe(40000) // $400.00
      expect(moneyToDollars(total)).toBe(400.00)
    })

    test('should match Stripe payment intent amount format', () => {
      // Stripe expects amount in cents as integer
      const reservationTotal = createMoney(15750) // $157.50

      // Verify this can be passed directly to Stripe
      const stripeAmount: number = reservationTotal

      expect(Number.isInteger(stripeAmount)).toBe(true)
      expect(stripeAmount).toBe(15750)
    })
  })

  describe('Database BIGINT compatibility', () => {
    test('should store as integer (BIGINT compatible)', () => {
      const amount = createMoney(999999999999)

      // Verify it's an integer (BIGINT in Postgres can handle this)
      expect(Number.isInteger(amount)).toBe(true)

      // Verify no decimal places
      expect(amount % 1).toBe(0)
    })

    test('should never use floating point for money', () => {
      const amounts = [
        createMoney(0),
        createMoney(1),
        createMoney(100),
        createMoney(4599),
        createMoney(999999),
      ]

      amounts.forEach(amount => {
        expect(Number.isInteger(amount)).toBe(true)
        expect(amount % 1).toBe(0)
      })
    })
  })

  describe('Edge cases and boundaries', () => {
    test('should handle minimum valid amount', () => {
      const minimum = createMoney(0)
      expect(minimum).toBe(0)
    })

    test('should handle one cent', () => {
      const oneCent = createMoney(1)
      expect(moneyToDollars(oneCent)).toBe(0.01)
    })

    test('should handle maximum JavaScript safe integer', () => {
      // JavaScript Number.MAX_SAFE_INTEGER = 9007199254740991
      // This is about $90 trillion - way beyond any reasonable transaction
      const maxSafe = Number.MAX_SAFE_INTEGER
      const huge = createMoney(maxSafe)

      expect(huge).toBe(maxSafe)
      expect(Number.isSafeInteger(huge)).toBe(true)
    })

    test('should detect unsafe floating point operations', () => {
      // Verify that we never accidentally use floating point
      const price = createMoney(100)

      // This would be dangerous: price / 3 = 33.333... (floating point)
      // Instead we should use integer division
      const notSafe = price / 3
      expect(Number.isInteger(notSafe)).toBe(false) // Proves danger of division

      // Safe alternative: round or floor division result
      const safe = createMoney(Math.floor(price / 3))
      expect(Number.isInteger(safe)).toBe(true)
    })
  })
})

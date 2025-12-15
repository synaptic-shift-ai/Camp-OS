/**
 * Tests for User-Defined Fees and Discounts Calculation Logic
 *
 * Unit tests for fee and discount calculations following TDD best practices.
 * These tests validate the calculation formulas for all fee and discount types.
 */

import { describe, test, expect } from 'vitest'
import type { UserDefinedFee, UserDefinedDiscount } from '@/lib/config/types'

// =====================================================
// Fee Calculation Helper (extracted for testing)
// =====================================================

/**
 * Calculate a user-defined fee amount based on its type
 *
 * @param fee - The fee configuration
 * @param subtotal - Nightly rate subtotal in cents
 * @param numNights - Number of nights in the stay
 * @param numGuests - Total number of guests
 * @param runningTotal - Running total for percentage_of_total (in cents)
 * @returns Fee amount in cents
 */
function calculateUserDefinedFee(
  fee: UserDefinedFee,
  subtotal: number,
  numNights: number,
  numGuests: number,
  runningTotal: number = subtotal
): number {
  if (!fee.enabled) return 0

  switch (fee.fee_type) {
    case 'flat_amount':
      return fee.value_cents ?? 0

    case 'percentage_of_subtotal':
      return Math.round(subtotal * (fee.value_percentage ?? 0) / 100)

    case 'percentage_of_total':
      return Math.round(runningTotal * (fee.value_percentage ?? 0) / 100)

    case 'per_night':
      return (fee.value_cents ?? 0) * numNights

    case 'per_guest':
      return (fee.value_cents ?? 0) * numGuests

    case 'per_guest_per_night':
      return (fee.value_cents ?? 0) * numGuests * numNights

    default:
      return 0
  }
}

// =====================================================
// Discount Calculation Helper (extracted for testing)
// =====================================================

/**
 * Check if a discount trigger condition is met
 *
 * @param discount - The discount configuration
 * @param numNights - Number of nights in the stay
 * @param numGuests - Total number of guests
 * @param checkInDate - Check-in date string
 * @returns True if the discount should be applied
 */
function shouldApplyDiscount(
  discount: UserDefinedDiscount,
  numNights: number,
  numGuests: number,
  checkInDate?: string
): boolean {
  if (!discount.enabled) return false
  if (discount.trigger_type === 'manual') return false

  const conditions = discount.trigger_conditions

  switch (discount.trigger_type) {
    case 'min_nights':
      return numNights >= (conditions?.min_nights ?? 0)

    case 'min_guests':
      return numGuests >= (conditions?.min_guests ?? 0)

    case 'date_range':
      if (!checkInDate) return false
      const check = new Date(checkInDate)
      const start = conditions?.start_date ? new Date(conditions.start_date) : null
      const end = conditions?.end_date ? new Date(conditions.end_date) : null
      if (start && check < start) return false
      if (end && check > end) return false
      return true

    default:
      return false
  }
}

/**
 * Calculate a user-defined discount amount based on its type
 *
 * @param discount - The discount configuration
 * @param subtotal - Nightly rate subtotal in cents
 * @param runningTotal - Running total for percentage_of_total (in cents)
 * @returns Discount amount in cents (before cap)
 */
function calculateUserDefinedDiscount(
  discount: UserDefinedDiscount,
  subtotal: number,
  runningTotal: number = subtotal
): number {
  switch (discount.discount_type) {
    case 'flat_amount':
      return discount.value_cents ?? 0

    case 'percentage_of_subtotal':
      return Math.round(subtotal * (discount.value_percentage ?? 0) / 100)

    case 'percentage_of_total':
      return Math.round(runningTotal * (discount.value_percentage ?? 0) / 100)

    default:
      return 0
  }
}

/**
 * Apply max discount cap if configured
 */
function applyDiscountCap(amount: number, maxCents?: number): number {
  if (maxCents && amount > maxCents) {
    return maxCents
  }
  return amount
}

// =====================================================
// Fee Calculation Tests
// =====================================================

describe('calculateUserDefinedFee', () => {
  const baseFee: UserDefinedFee = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Fee',
    fee_type: 'flat_amount',
    value_cents: 2500,
    is_taxable: true,
    display_order: 0,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
  }

  describe('flat_amount fee', () => {
    test('should return value_cents for flat_amount fee', () => {
      const fee: UserDefinedFee = { ...baseFee, fee_type: 'flat_amount', value_cents: 2500 }
      const result = calculateUserDefinedFee(fee, 10000, 3, 2)
      expect(result).toBe(2500)
    })

    test('should return 0 when value_cents is not set', () => {
      const { value_cents: _, ...feeWithoutValue } = baseFee
      const fee = { ...feeWithoutValue, fee_type: 'flat_amount' as const }
      const result = calculateUserDefinedFee(fee as UserDefinedFee, 10000, 3, 2)
      expect(result).toBe(0)
    })

    test('should return 0 when fee is disabled', () => {
      const fee: UserDefinedFee = { ...baseFee, fee_type: 'flat_amount', value_cents: 2500, enabled: false }
      const result = calculateUserDefinedFee(fee, 10000, 3, 2)
      expect(result).toBe(0)
    })
  })

  describe('percentage_of_subtotal fee', () => {
    test('should calculate 10% of $100 subtotal as $10', () => {
      const { value_cents: _, ...feeBase } = baseFee
      const fee = {
        ...feeBase,
        fee_type: 'percentage_of_subtotal' as const,
        value_percentage: 10,
      } as UserDefinedFee
      const result = calculateUserDefinedFee(fee, 10000, 3, 2) // $100 subtotal
      expect(result).toBe(1000) // $10
    })

    test('should calculate 5.5% of $200 subtotal', () => {
      const { value_cents: _, ...feeBase } = baseFee
      const fee = {
        ...feeBase,
        fee_type: 'percentage_of_subtotal' as const,
        value_percentage: 5.5,
      } as UserDefinedFee
      const result = calculateUserDefinedFee(fee, 20000, 3, 2) // $200 subtotal
      expect(result).toBe(1100) // $11
    })

    test('should round to nearest cent', () => {
      const { value_cents: _, ...feeBase } = baseFee
      const fee = {
        ...feeBase,
        fee_type: 'percentage_of_subtotal' as const,
        value_percentage: 3.33,
      } as UserDefinedFee
      const result = calculateUserDefinedFee(fee, 10000, 3, 2) // $100 subtotal
      expect(result).toBe(333) // $3.33
    })
  })

  describe('percentage_of_total fee', () => {
    test('should calculate 8% of $150 running total', () => {
      const { value_cents: _, ...feeBase } = baseFee
      const fee = {
        ...feeBase,
        fee_type: 'percentage_of_total' as const,
        value_percentage: 8,
      } as UserDefinedFee
      const result = calculateUserDefinedFee(fee, 10000, 3, 2, 15000) // $150 running total
      expect(result).toBe(1200) // $12
    })
  })

  describe('per_night fee', () => {
    test('should multiply value by number of nights', () => {
      const fee: UserDefinedFee = { ...baseFee, fee_type: 'per_night', value_cents: 500 }
      const result = calculateUserDefinedFee(fee, 10000, 5, 2) // 5 nights
      expect(result).toBe(2500) // $5 x 5 nights = $25
    })

    test('should calculate for single night', () => {
      const fee: UserDefinedFee = { ...baseFee, fee_type: 'per_night', value_cents: 1000 }
      const result = calculateUserDefinedFee(fee, 10000, 1, 2) // 1 night
      expect(result).toBe(1000) // $10 x 1 night = $10
    })
  })

  describe('per_guest fee', () => {
    test('should multiply value by number of guests', () => {
      const fee: UserDefinedFee = { ...baseFee, fee_type: 'per_guest', value_cents: 1500 }
      const result = calculateUserDefinedFee(fee, 10000, 3, 4) // 4 guests
      expect(result).toBe(6000) // $15 x 4 guests = $60
    })

    test('should calculate for single guest', () => {
      const fee: UserDefinedFee = { ...baseFee, fee_type: 'per_guest', value_cents: 2000 }
      const result = calculateUserDefinedFee(fee, 10000, 3, 1) // 1 guest
      expect(result).toBe(2000) // $20 x 1 guest = $20
    })
  })

  describe('per_guest_per_night fee', () => {
    test('should multiply value by guests AND nights', () => {
      const fee: UserDefinedFee = { ...baseFee, fee_type: 'per_guest_per_night', value_cents: 500 }
      const result = calculateUserDefinedFee(fee, 10000, 3, 4) // 3 nights, 4 guests
      expect(result).toBe(6000) // $5 x 4 guests x 3 nights = $60
    })

    test('should calculate for 7 nights and 2 guests', () => {
      const fee: UserDefinedFee = { ...baseFee, fee_type: 'per_guest_per_night', value_cents: 200 }
      const result = calculateUserDefinedFee(fee, 10000, 7, 2) // 7 nights, 2 guests
      expect(result).toBe(2800) // $2 x 2 guests x 7 nights = $28
    })
  })
})

// =====================================================
// Discount Trigger Tests
// =====================================================

describe('shouldApplyDiscount', () => {
  const baseDiscount: UserDefinedDiscount = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Test Discount',
    discount_type: 'percentage_of_subtotal',
    value_percentage: 10,
    trigger_type: 'min_nights',
    trigger_conditions: { min_nights: 7 },
    display_order: 0,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
  }

  test('should return false for disabled discount', () => {
    const discount = { ...baseDiscount, enabled: false }
    expect(shouldApplyDiscount(discount, 10, 2)).toBe(false)
  })

  test('should return false for manual trigger', () => {
    const discount = { ...baseDiscount, trigger_type: 'manual' as const }
    expect(shouldApplyDiscount(discount, 10, 2)).toBe(false)
  })

  describe('min_nights trigger', () => {
    test('should apply when nights >= min_nights', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'min_nights' as const,
        trigger_conditions: { min_nights: 7 },
      }
      expect(shouldApplyDiscount(discount, 7, 2)).toBe(true)
      expect(shouldApplyDiscount(discount, 10, 2)).toBe(true)
    })

    test('should not apply when nights < min_nights', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'min_nights' as const,
        trigger_conditions: { min_nights: 7 },
      }
      expect(shouldApplyDiscount(discount, 6, 2)).toBe(false)
      expect(shouldApplyDiscount(discount, 1, 2)).toBe(false)
    })
  })

  describe('min_guests trigger', () => {
    test('should apply when guests >= min_guests', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'min_guests' as const,
        trigger_conditions: { min_guests: 4 },
      }
      expect(shouldApplyDiscount(discount, 3, 4)).toBe(true)
      expect(shouldApplyDiscount(discount, 3, 6)).toBe(true)
    })

    test('should not apply when guests < min_guests', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'min_guests' as const,
        trigger_conditions: { min_guests: 4 },
      }
      expect(shouldApplyDiscount(discount, 3, 3)).toBe(false)
      expect(shouldApplyDiscount(discount, 3, 1)).toBe(false)
    })
  })

  describe('date_range trigger', () => {
    test('should apply when check-in is within date range', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'date_range' as const,
        trigger_conditions: {
          start_date: '2024-06-01',
          end_date: '2024-08-31',
        },
      }
      expect(shouldApplyDiscount(discount, 3, 2, '2024-07-15')).toBe(true)
      expect(shouldApplyDiscount(discount, 3, 2, '2024-06-01')).toBe(true)
      expect(shouldApplyDiscount(discount, 3, 2, '2024-08-31')).toBe(true)
    })

    test('should not apply when check-in is before start_date', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'date_range' as const,
        trigger_conditions: {
          start_date: '2024-06-01',
          end_date: '2024-08-31',
        },
      }
      expect(shouldApplyDiscount(discount, 3, 2, '2024-05-31')).toBe(false)
    })

    test('should not apply when check-in is after end_date', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'date_range' as const,
        trigger_conditions: {
          start_date: '2024-06-01',
          end_date: '2024-08-31',
        },
      }
      expect(shouldApplyDiscount(discount, 3, 2, '2024-09-01')).toBe(false)
    })

    test('should return false when no check-in date provided', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'date_range' as const,
        trigger_conditions: {
          start_date: '2024-06-01',
          end_date: '2024-08-31',
        },
      }
      expect(shouldApplyDiscount(discount, 3, 2, undefined)).toBe(false)
    })

    test('should apply when only start_date is set and check-in is after', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'date_range' as const,
        trigger_conditions: { start_date: '2024-06-01' },
      }
      expect(shouldApplyDiscount(discount, 3, 2, '2024-07-15')).toBe(true)
    })

    test('should apply when only end_date is set and check-in is before', () => {
      const discount = {
        ...baseDiscount,
        trigger_type: 'date_range' as const,
        trigger_conditions: { end_date: '2024-08-31' },
      }
      expect(shouldApplyDiscount(discount, 3, 2, '2024-07-15')).toBe(true)
    })
  })
})

// =====================================================
// Discount Calculation Tests
// =====================================================

describe('calculateUserDefinedDiscount', () => {
  const baseDiscount: UserDefinedDiscount = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Test Discount',
    discount_type: 'percentage_of_subtotal',
    value_percentage: 10,
    trigger_type: 'min_nights',
    trigger_conditions: { min_nights: 7 },
    display_order: 0,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
  }

  describe('flat_amount discount', () => {
    test('should return value_cents for flat discount', () => {
      const discount = { ...baseDiscount, discount_type: 'flat_amount' as const, value_cents: 5000 }
      const result = calculateUserDefinedDiscount(discount, 10000)
      expect(result).toBe(5000) // $50 off
    })
  })

  describe('percentage_of_subtotal discount', () => {
    test('should calculate 10% off $100 subtotal', () => {
      const discount = { ...baseDiscount, discount_type: 'percentage_of_subtotal' as const, value_percentage: 10 }
      const result = calculateUserDefinedDiscount(discount, 10000) // $100 subtotal
      expect(result).toBe(1000) // $10 off
    })

    test('should calculate 25% off $200 subtotal', () => {
      const discount = { ...baseDiscount, discount_type: 'percentage_of_subtotal' as const, value_percentage: 25 }
      const result = calculateUserDefinedDiscount(discount, 20000) // $200 subtotal
      expect(result).toBe(5000) // $50 off
    })
  })

  describe('percentage_of_total discount', () => {
    test('should calculate 15% off $150 running total', () => {
      const discount = { ...baseDiscount, discount_type: 'percentage_of_total' as const, value_percentage: 15 }
      const result = calculateUserDefinedDiscount(discount, 10000, 15000) // $150 total
      expect(result).toBe(2250) // $22.50 off
    })
  })
})

describe('applyDiscountCap', () => {
  test('should return original amount when no cap', () => {
    expect(applyDiscountCap(5000, undefined)).toBe(5000)
  })

  test('should return original amount when under cap', () => {
    expect(applyDiscountCap(3000, 5000)).toBe(3000)
  })

  test('should return capped amount when over cap', () => {
    expect(applyDiscountCap(7500, 5000)).toBe(5000)
  })

  test('should return cap when amount equals cap', () => {
    expect(applyDiscountCap(5000, 5000)).toBe(5000)
  })
})

// =====================================================
// Integration-style Calculation Tests
// =====================================================

describe('full fee and discount calculation flow', () => {
  test('should calculate total with multiple fees and discounts', () => {
    // Scenario: 7-night stay, 4 guests, $50/night
    const subtotal = 35000 // $350 for 7 nights
    const numNights = 7
    const numGuests = 4

    // Fees
    const cleaningFee: UserDefinedFee = {
      id: '1',
      title: 'Cleaning Fee',
      fee_type: 'flat_amount',
      value_cents: 5000,
      is_taxable: true,
      display_order: 0,
      enabled: true,
      created_at: '2024-01-01T00:00:00Z',
    }

    const serviceFee: UserDefinedFee = {
      id: '2',
      title: 'Service Fee',
      fee_type: 'percentage_of_subtotal',
      value_percentage: 5,
      is_taxable: true,
      display_order: 1,
      enabled: true,
      created_at: '2024-01-01T00:00:00Z',
    }

    const extraGuestFee: UserDefinedFee = {
      id: '3',
      title: 'Extra Guest Fee',
      fee_type: 'per_guest_per_night',
      value_cents: 500, // $5 per extra guest per night
      is_taxable: true,
      display_order: 2,
      enabled: true,
      created_at: '2024-01-01T00:00:00Z',
    }

    // Calculate fees
    const cleaningAmount = calculateUserDefinedFee(cleaningFee, subtotal, numNights, numGuests)
    const serviceAmount = calculateUserDefinedFee(serviceFee, subtotal, numNights, numGuests)
    const extraGuestAmount = calculateUserDefinedFee(extraGuestFee, subtotal, numNights, numGuests)

    expect(cleaningAmount).toBe(5000) // $50 flat
    expect(serviceAmount).toBe(1750) // 5% of $350 = $17.50
    expect(extraGuestAmount).toBe(14000) // $5 x 4 guests x 7 nights = $140

    const totalFees = cleaningAmount + serviceAmount + extraGuestAmount
    expect(totalFees).toBe(20750) // $207.50 in fees

    // Weekly discount
    const weeklyDiscount: UserDefinedDiscount = {
      id: '4',
      title: 'Weekly Discount',
      discount_type: 'percentage_of_subtotal',
      value_percentage: 10,
      trigger_type: 'min_nights',
      trigger_conditions: { min_nights: 7 },
      display_order: 0,
      enabled: true,
      created_at: '2024-01-01T00:00:00Z',
    }

    const shouldApply = shouldApplyDiscount(weeklyDiscount, numNights, numGuests)
    expect(shouldApply).toBe(true)

    const discountAmount = calculateUserDefinedDiscount(weeklyDiscount, subtotal)
    expect(discountAmount).toBe(3500) // 10% of $350 = $35 off

    // Final calculation
    const total = subtotal + totalFees - discountAmount
    expect(total).toBe(52250) // $350 + $207.50 - $35 = $522.50
  })

  test('should handle capped discount correctly', () => {
    const subtotal = 100000 // $1000 subtotal
    const discount: UserDefinedDiscount = {
      id: '1',
      title: 'Big Discount',
      discount_type: 'percentage_of_subtotal',
      value_percentage: 20,
      trigger_type: 'min_nights',
      trigger_conditions: { min_nights: 1 },
      max_discount_cents: 10000, // Max $100 off
      display_order: 0,
      enabled: true,
      created_at: '2024-01-01T00:00:00Z',
    }

    // 20% of $1000 = $200, but capped at $100
    const rawDiscount = calculateUserDefinedDiscount(discount, subtotal)
    expect(rawDiscount).toBe(20000) // $200 before cap

    const cappedDiscount = applyDiscountCap(rawDiscount, discount.max_discount_cents)
    expect(cappedDiscount).toBe(10000) // $100 after cap
  })
})

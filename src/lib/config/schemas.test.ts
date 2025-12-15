/**
 * Tests for Configuration Validation Schemas
 *
 * Unit tests for Zod schemas used to validate user-defined fees and discounts.
 * Following TDD best practices (T-1 through T-13).
 */

import { describe, test, expect } from 'vitest'
import {
  userDefinedFeeSchema,
  userDefinedDiscountSchema,
  pricingConfigSchema,
  rateDiscountsConfigSchema,
} from './schemas'

describe('userDefinedFeeSchema', () => {
  const validBaseFee = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Cleaning Fee',
    fee_type: 'flat_amount' as const,
    value_cents: 2500,
    is_taxable: true,
    display_order: 0,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
  }

  test('should accept valid flat_amount fee with value_cents', () => {
    const result = userDefinedFeeSchema.safeParse(validBaseFee)
    expect(result.success).toBe(true)
  })

  test('should accept valid percentage_of_subtotal fee with value_percentage', () => {
    const fee = {
      ...validBaseFee,
      fee_type: 'percentage_of_subtotal' as const,
      value_cents: undefined,
      value_percentage: 10.5,
    }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(true)
  })

  test('should accept valid percentage_of_total fee with value_percentage', () => {
    const fee = {
      ...validBaseFee,
      fee_type: 'percentage_of_total' as const,
      value_cents: undefined,
      value_percentage: 5,
    }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(true)
  })

  test('should accept valid per_night fee with value_cents', () => {
    const fee = {
      ...validBaseFee,
      fee_type: 'per_night' as const,
      value_cents: 500,
    }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(true)
  })

  test('should accept valid per_guest fee with value_cents', () => {
    const fee = {
      ...validBaseFee,
      fee_type: 'per_guest' as const,
      value_cents: 1000,
    }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(true)
  })

  test('should accept valid per_guest_per_night fee with value_cents', () => {
    const fee = {
      ...validBaseFee,
      fee_type: 'per_guest_per_night' as const,
      value_cents: 750,
    }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(true)
  })

  test('should accept fee with optional description', () => {
    const fee = {
      ...validBaseFee,
      description: 'One-time cleaning fee for the site',
    }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(true)
  })

  test('should reject fee with empty title', () => {
    const fee = { ...validBaseFee, title: '' }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(false)
  })

  test('should reject fee with title exceeding 100 characters', () => {
    const fee = { ...validBaseFee, title: 'A'.repeat(101) }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(false)
  })

  test('should reject fee with invalid fee_type', () => {
    const fee = { ...validBaseFee, fee_type: 'invalid_type' }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(false)
  })

  test('should reject fee with negative value_cents', () => {
    const fee = { ...validBaseFee, value_cents: -100 }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(false)
  })

  test('should reject percentage fee with value > 100', () => {
    const fee = {
      ...validBaseFee,
      fee_type: 'percentage_of_subtotal' as const,
      value_cents: undefined,
      value_percentage: 150,
    }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(false)
  })

  test('should reject fee with invalid UUID for id', () => {
    const fee = { ...validBaseFee, id: 'not-a-uuid' }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(false)
  })

  test('should reject fee with negative display_order', () => {
    const fee = { ...validBaseFee, display_order: -1 }
    const result = userDefinedFeeSchema.safeParse(fee)
    expect(result.success).toBe(false)
  })
})

describe('userDefinedDiscountSchema', () => {
  const validBaseDiscount = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Weekly Discount',
    discount_type: 'percentage_of_subtotal' as const,
    value_percentage: 10,
    trigger_type: 'min_nights' as const,
    trigger_conditions: { min_nights: 7 },
    display_order: 0,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
  }

  test('should accept valid percentage discount with min_nights trigger', () => {
    const result = userDefinedDiscountSchema.safeParse(validBaseDiscount)
    expect(result.success).toBe(true)
  })

  test('should accept valid flat_amount discount', () => {
    const discount = {
      ...validBaseDiscount,
      discount_type: 'flat_amount' as const,
      value_percentage: undefined,
      value_cents: 5000,
    }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(true)
  })

  test('should accept valid percentage_of_total discount', () => {
    const discount = {
      ...validBaseDiscount,
      discount_type: 'percentage_of_total' as const,
      value_percentage: 15,
    }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(true)
  })

  test('should accept manual trigger discount', () => {
    const discount = {
      ...validBaseDiscount,
      trigger_type: 'manual' as const,
      trigger_conditions: undefined,
    }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(true)
  })

  test('should accept min_guests trigger discount', () => {
    const discount = {
      ...validBaseDiscount,
      trigger_type: 'min_guests' as const,
      trigger_conditions: { min_guests: 4 },
    }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(true)
  })

  test('should accept date_range trigger discount', () => {
    const discount = {
      ...validBaseDiscount,
      trigger_type: 'date_range' as const,
      trigger_conditions: {
        start_date: '2024-06-01',
        end_date: '2024-08-31',
      },
    }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(true)
  })

  test('should accept discount with max_discount_cents cap', () => {
    const discount = {
      ...validBaseDiscount,
      max_discount_cents: 10000,
    }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(true)
  })

  test('should accept discount with optional description', () => {
    const discount = {
      ...validBaseDiscount,
      description: 'Get 10% off for stays of 7+ nights',
    }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(true)
  })

  test('should reject discount with empty title', () => {
    const discount = { ...validBaseDiscount, title: '' }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(false)
  })

  test('should reject discount with invalid discount_type', () => {
    const discount = { ...validBaseDiscount, discount_type: 'invalid' }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(false)
  })

  test('should reject discount with invalid trigger_type', () => {
    const discount = { ...validBaseDiscount, trigger_type: 'invalid' }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(false)
  })

  test('should reject discount with percentage > 100', () => {
    const discount = { ...validBaseDiscount, value_percentage: 150 }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(false)
  })

  test('should reject discount with negative value_cents', () => {
    const discount = {
      ...validBaseDiscount,
      discount_type: 'flat_amount' as const,
      value_percentage: undefined,
      value_cents: -100,
    }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(false)
  })

  test('should reject min_nights trigger with zero nights', () => {
    const discount = {
      ...validBaseDiscount,
      trigger_conditions: { min_nights: 0 },
    }
    const result = userDefinedDiscountSchema.safeParse(discount)
    expect(result.success).toBe(false)
  })
})

describe('pricingConfigSchema', () => {
  const validPricingConfig = {
    tax_rate: 0.085,
    tax_name: 'Sales Tax',
    user_defined_fees: [],
  }

  test('should accept valid pricing config with empty fees array', () => {
    const result = pricingConfigSchema.safeParse(validPricingConfig)
    expect(result.success).toBe(true)
  })

  test('should accept pricing config with user-defined fees', () => {
    const config = {
      ...validPricingConfig,
      user_defined_fees: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Cleaning Fee',
          fee_type: 'flat_amount',
          value_cents: 2500,
          is_taxable: true,
          display_order: 0,
          enabled: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    }
    const result = pricingConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  test('should accept pricing config with legacy fee fields', () => {
    const config = {
      ...validPricingConfig,
      service_fee_type: 'percentage',
      service_fee_percentage: 5,
      default_cleaning_fee_cents: 2500,
      pet_fee_cents: 2000,
      extra_guest_fee_enabled: true,
      extra_guest_threshold: 2,
      extra_guest_fee_cents: 1000,
    }
    const result = pricingConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  test('should reject pricing config with tax_rate > 1', () => {
    const config = { ...validPricingConfig, tax_rate: 1.5 }
    const result = pricingConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  test('should reject pricing config with negative tax_rate', () => {
    const config = { ...validPricingConfig, tax_rate: -0.05 }
    const result = pricingConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  test('should use default empty array when user_defined_fees is missing', () => {
    const { user_defined_fees, ...configWithoutFees } = validPricingConfig
    const result = pricingConfigSchema.safeParse(configWithoutFees)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.user_defined_fees).toEqual([])
    }
  })
})

describe('rateDiscountsConfigSchema', () => {
  const validDiscountsConfig = {
    user_defined_discounts: [],
  }

  test('should accept valid discounts config with empty array', () => {
    const result = rateDiscountsConfigSchema.safeParse(validDiscountsConfig)
    expect(result.success).toBe(true)
  })

  test('should accept discounts config with user-defined discounts', () => {
    const config = {
      ...validDiscountsConfig,
      user_defined_discounts: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Weekly Discount',
          discount_type: 'percentage_of_subtotal',
          value_percentage: 10,
          trigger_type: 'min_nights',
          trigger_conditions: { min_nights: 7 },
          display_order: 0,
          enabled: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    }
    const result = rateDiscountsConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  test('should accept discounts config with legacy discount fields', () => {
    const config = {
      ...validDiscountsConfig,
      weekly_discount_enabled: true,
      weekly_discount_percentage: 10,
      weekly_minimum_nights: 7,
      monthly_discount_enabled: true,
      monthly_discount_percentage: 25,
      monthly_minimum_nights: 28,
    }
    const result = rateDiscountsConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  test('should use default empty array when user_defined_discounts is missing', () => {
    const result = rateDiscountsConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.user_defined_discounts).toEqual([])
    }
  })

  test('should reject legacy discount percentage > 100', () => {
    const config = {
      ...validDiscountsConfig,
      weekly_discount_enabled: true,
      weekly_discount_percentage: 150,
    }
    const result = rateDiscountsConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })
})

/**
 * Configuration Validation Schemas
 *
 * Zod schemas for validating property and site configuration settings.
 * Used for form validation in admin UI and API request validation.
 *
 * @module lib/config/schemas
 */

import { z } from 'zod'

// =====================================================
// Base Schemas
// =====================================================

export const dayOfWeekSchema = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
])

export const bookingTypeSchema = z.enum([
  'nightly',
  'weekly',
  'monthly',
  'seasonal',
  'long_term',
])

export const depositTypeSchema = z.enum(['percentage', 'flat_amount', 'first_night'])

export const serviceFeeTypeSchema = z.enum(['none', 'percentage', 'flat', 'per_night'])

// =====================================================
// Deposit Configuration Schema
// =====================================================

const depositConfigBaseSchema = z.object({
  require_deposit: z.boolean({
    required_error: 'Deposit requirement must be specified',
  }),

  deposit_type: depositTypeSchema.default('percentage'),

  deposit_percentage: z
    .number()
    .min(0, 'Deposit percentage must be at least 0%')
    .max(100, 'Deposit percentage cannot exceed 100%')
    .optional(),

  deposit_amount_cents: z
    .number()
    .int('Deposit amount must be a whole number')
    .min(0, 'Deposit amount cannot be negative')
    .optional()
    .nullable(),

  applies_to_booking_types: z
    .array(bookingTypeSchema)
    .min(0, 'Must specify at least one booking type')
    .default(['nightly', 'weekly', 'monthly', 'seasonal', 'long_term']),

  exempt_if_paid_in_full: z.boolean().default(true),

  full_payment_required_days_before: z
    .number()
    .int('Days must be a whole number')
    .min(0, 'Days before cannot be negative')
    .optional()
    .nullable(),
})

export const depositConfigSchema = depositConfigBaseSchema
  .refine(
    (data) => {
      // If deposit required and type is percentage, percentage must be provided
      if (data.require_deposit && data.deposit_type === 'percentage') {
        return data.deposit_percentage !== undefined && data.deposit_percentage > 0
      }
      return true
    },
    {
      message: 'Deposit percentage is required when deposit type is "percentage"',
      path: ['deposit_percentage'],
    }
  )
  .refine(
    (data) => {
      // If deposit required and type is flat_amount, amount must be provided
      if (data.require_deposit && data.deposit_type === 'flat_amount') {
        return data.deposit_amount_cents !== undefined && data.deposit_amount_cents !== null && data.deposit_amount_cents > 0
      }
      return true
    },
    {
      message: 'Deposit amount is required when deposit type is "flat_amount"',
      path: ['deposit_amount_cents'],
    }
  )

// =====================================================
// Pricing Configuration Schema
// =====================================================

export const pricingConfigSchema = z.object({
  tax_rate: z
    .number()
    .min(0, 'Tax rate cannot be negative')
    .max(1, 'Tax rate cannot exceed 100% (use decimal, e.g., 0.085 for 8.5%)')
    .default(0.0),

  tax_name: z
    .string()
    .min(1, 'Tax name is required')
    .max(100, 'Tax name is too long')
    .default('Tax'),

  service_fee_type: serviceFeeTypeSchema.default('none'),

  service_fee_percentage: z
    .number()
    .min(0, 'Service fee percentage cannot be negative')
    .max(100, 'Service fee percentage cannot exceed 100%')
    .optional()
    .default(0),

  service_fee_amount_cents: z
    .number()
    .int('Service fee must be a whole number')
    .min(0, 'Service fee cannot be negative')
    .optional()
    .nullable(),

  default_cleaning_fee_cents: z
    .number()
    .int('Cleaning fee must be a whole number')
    .min(0, 'Cleaning fee cannot be negative')
    .optional()
    .nullable(),

  extra_guest_fee_enabled: z.boolean().default(false),

  extra_guest_threshold: z
    .number()
    .int('Guest threshold must be a whole number')
    .min(1, 'Guest threshold must be at least 1')
    .max(20, 'Guest threshold seems unreasonably high')
    .default(2),

  extra_guest_fee_cents: z
    .number()
    .int('Extra guest fee must be a whole number')
    .min(0, 'Extra guest fee cannot be negative')
    .default(0),

  pet_fee_cents: z
    .number()
    .int('Pet fee must be a whole number')
    .min(0, 'Pet fee cannot be negative')
    .default(2000),
})

// =====================================================
// Booking Rules Configuration Schema
// =====================================================

const bookingRulesConfigBaseSchema = z.object({
  min_stay_nights: z
    .number()
    .int('Minimum stay must be a whole number')
    .min(1, 'Minimum stay must be at least 1 night')
    .max(365, 'Minimum stay cannot exceed 365 nights')
    .default(1),

  max_stay_nights: z
    .number()
    .int('Maximum stay must be a whole number')
    .min(1, 'Maximum stay must be at least 1 night')
    .optional()
    .nullable(),

  booking_window_days: z
    .number()
    .int('Booking window must be a whole number')
    .min(1, 'Booking window must be at least 1 day')
    .max(730, 'Booking window cannot exceed 2 years')
    .default(365),

  advance_notice_days: z
    .number()
    .int('Advance notice must be a whole number')
    .min(0, 'Advance notice cannot be negative')
    .max(90, 'Advance notice seems unreasonably high')
    .default(0),

  allowed_checkin_days: z
    .array(dayOfWeekSchema)
    .min(1, 'At least one check-in day must be allowed')
    .default(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),

  allowed_checkout_days: z
    .array(dayOfWeekSchema)
    .min(1, 'At least one check-out day must be allowed')
    .default(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),

  blackout_dates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'))
    .default([]),

  same_day_booking_enabled: z.boolean().default(true),

  instant_booking_enabled: z.boolean().default(true),
})

export const bookingRulesConfigSchema = bookingRulesConfigBaseSchema
  .refine(
    (data) => {
      // If max_stay is set, it must be >= min_stay
      if (data.max_stay_nights !== null && data.max_stay_nights !== undefined) {
        return data.max_stay_nights >= data.min_stay_nights
      }
      return true
    },
    {
      message: 'Maximum stay must be greater than or equal to minimum stay',
      path: ['max_stay_nights'],
    }
  )

// =====================================================
// Rate Discounts Configuration Schema
// =====================================================

export const rateDiscountsConfigSchema = z
  .object({
    weekly_discount_enabled: z.boolean().default(false),

    weekly_discount_percentage: z
      .number()
      .min(0, 'Discount percentage cannot be negative')
      .max(100, 'Discount percentage cannot exceed 100%')
      .default(0),

    weekly_minimum_nights: z
      .number()
      .int('Minimum nights must be a whole number')
      .min(2, 'Weekly minimum must be at least 2 nights')
      .max(14, 'Weekly minimum seems too high')
      .default(7),

    monthly_discount_enabled: z.boolean().default(false),

    monthly_discount_percentage: z
      .number()
      .min(0, 'Discount percentage cannot be negative')
      .max(100, 'Discount percentage cannot exceed 100%')
      .default(0),

    monthly_minimum_nights: z
      .number()
      .int('Minimum nights must be a whole number')
      .min(7, 'Monthly minimum must be at least 7 nights')
      .max(60, 'Monthly minimum seems too high')
      .default(28),
  })
  .refine(
    (data) => {
      // Monthly minimum should be > weekly minimum
      return data.monthly_minimum_nights >= data.weekly_minimum_nights
    },
    {
      message: 'Monthly minimum nights should be greater than or equal to weekly minimum nights',
      path: ['monthly_minimum_nights'],
    }
  )

// =====================================================
// Seasonal Pricing Schemas
// =====================================================

const seasonalPricingEntryBaseSchema = z.object({
  season: z.string().min(1, 'Season name is required').max(100, 'Season name is too long'),

  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),

  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),

  price_cents: z
    .number()
    .int('Price must be a whole number')
    .min(1, 'Price must be at least $0.01')
    .max(100000000, 'Price seems unreasonably high'),

  applies_to_weekends: z.boolean().default(false),
})

export const seasonalPricingEntrySchema = seasonalPricingEntryBaseSchema.refine(
  (data) => {
    // End date must be >= start date
    return new Date(data.end_date) >= new Date(data.start_date)
  },
  {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  }
)

export const seasonalPricingTemplateSchema = z.object({
  id: z.string().uuid().optional(), // Optional for create, required for update
  property_id: z.string().uuid(),

  name: z.string().min(1, 'Template name is required').max(255, 'Template name is too long'),

  description: z.string().max(1000, 'Description is too long').optional().nullable(),

  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),

  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),

  price_cents: z
    .number()
    .int('Price must be a whole number')
    .min(1, 'Price must be at least $0.01')
    .max(100000000, 'Price seems unreasonably high'),

  applies_to_weekends: z.boolean().default(false),

  recurring_annually: z.boolean().default(false),
}).refine(
  (data) => {
    return new Date(data.end_date) >= new Date(data.start_date)
  },
  {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  }
)

export const siteSeasonalTemplateApplicationSchema = z.object({
  id: z.string().uuid().optional(),
  site_id: z.string().uuid(),
  template_id: z.string().uuid(),

  price_override_cents: z
    .number()
    .int('Price override must be a whole number')
    .min(1, 'Price override must be at least $0.01')
    .optional()
    .nullable(),
})

// =====================================================
// Site Configuration Override Schemas
// =====================================================

// For site overrides, we allow partial configurations (use base schemas without refine)
export const siteDepositOverrideSchema = depositConfigBaseSchema.partial()

export const sitePricingOverrideSchema = pricingConfigSchema.partial()

export const siteBookingRulesOverrideSchema = bookingRulesConfigBaseSchema.partial()

// =====================================================
// Form Schemas (for UI)
// =====================================================

/**
 * Deposit Configuration Form Schema
 * Converts dollar amounts to cents for API
 */
export const depositConfigFormSchema = depositConfigBaseSchema
  .omit({ deposit_amount_cents: true })
  .extend({
    deposit_amount_dollars: z
      .number()
      .min(0, 'Deposit amount cannot be negative')
      .optional()
      .nullable(),
  })

/**
 * Pricing Configuration Form Schema
 * Converts dollar amounts to cents for API
 */
export const pricingConfigFormSchema = pricingConfigSchema
  .omit({
    service_fee_amount_cents: true,
    default_cleaning_fee_cents: true,
    extra_guest_fee_cents: true,
    pet_fee_cents: true,
  })
  .extend({
    service_fee_amount_dollars: z.number().min(0).optional().nullable(),
    default_cleaning_fee_dollars: z.number().min(0).optional().nullable(),
    extra_guest_fee_dollars: z.number().min(0).default(0),
    pet_fee_dollars: z.number().min(0).default(20),
    tax_rate_percentage: z.number().min(0).max(100).default(0), // Display as percentage (8.5 instead of 0.085)
  })

/**
 * Seasonal Pricing Form Schema
 * Converts cents to dollars for form display
 */
export const seasonalPricingFormSchema = seasonalPricingEntryBaseSchema
  .omit({ price_cents: true })
  .extend({
    price_dollars: z.number().min(0.01, 'Price must be at least $0.01'),
  })

// =====================================================
// Bulk Update Schemas
// =====================================================

export const bulkConfigurationApplicationSchema = z.object({
  site_ids: z.array(z.string().uuid()).min(1, 'At least one site must be selected'),

  changes: z.object({
    deposit_override: siteDepositOverrideSchema.optional(),
    pricing_override: sitePricingOverrideSchema.optional(),
    booking_rules_override: siteBookingRulesOverrideSchema.optional(),
  }),

  merge_mode: z.enum(['merge', 'replace']).default('merge'),
})

// =====================================================
// API Request Schemas
// =====================================================

/**
 * Update Property Configuration Request
 */
export const updatePropertyConfigSchema = z.object({
  deposit_config: depositConfigSchema.optional(),
  pricing_config: pricingConfigSchema.optional(),
  booking_rules_config: bookingRulesConfigSchema.optional(),
  rate_discounts_config: rateDiscountsConfigSchema.optional(),
})

/**
 * Update Site Configuration Request
 */
export const updateSiteConfigSchema = z.object({
  deposit_override: siteDepositOverrideSchema.optional().nullable(),
  pricing_override: sitePricingOverrideSchema.optional().nullable(),
  booking_rules_override: siteBookingRulesOverrideSchema.optional().nullable(),
  weekly_rate_cents: z.number().int().min(0).optional().nullable(),
  monthly_rate_cents: z.number().int().min(0).optional().nullable(),
})

// =====================================================
// Helper Functions for Form Conversion
// =====================================================

/**
 * Convert cents to dollars for form display
 */
export function centsToFormDollars(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null
  return cents / 100
}

/**
 * Convert dollars from form to cents for API
 */
export function formDollarsToCents(dollars: number | null | undefined): number | null {
  if (dollars === null || dollars === undefined) return null
  return Math.round(dollars * 100)
}

/**
 * Convert tax rate to percentage for form display
 */
export function taxRateToPercentage(rate: number): number {
  return rate * 100
}

/**
 * Convert percentage from form to tax rate for API
 */
export function percentageToTaxRate(percentage: number): number {
  return percentage / 100
}

/**
 * Convert pricing config to form values
 */
export function pricingConfigToFormValues(config: z.infer<typeof pricingConfigSchema>) {
  return {
    ...config,
    tax_rate_percentage: taxRateToPercentage(config.tax_rate),
    service_fee_amount_dollars: centsToFormDollars(config.service_fee_amount_cents ?? null),
    default_cleaning_fee_dollars: centsToFormDollars(config.default_cleaning_fee_cents ?? null),
    extra_guest_fee_dollars: centsToFormDollars(config.extra_guest_fee_cents),
    pet_fee_dollars: centsToFormDollars(config.pet_fee_cents),
  }
}

/**
 * Convert form values to pricing config
 */
export function formValuesToPricingConfig(
  formValues: z.infer<typeof pricingConfigFormSchema>
): z.infer<typeof pricingConfigSchema> {
  return {
    ...formValues,
    tax_rate: percentageToTaxRate(formValues.tax_rate_percentage),
    service_fee_amount_cents: formDollarsToCents(formValues.service_fee_amount_dollars),
    default_cleaning_fee_cents: formDollarsToCents(formValues.default_cleaning_fee_dollars),
    extra_guest_fee_cents: formDollarsToCents(formValues.extra_guest_fee_dollars) ?? 0,
    pet_fee_cents: formDollarsToCents(formValues.pet_fee_dollars) ?? 2000,
  }
}

/**
 * Convert deposit config to form values
 */
export function depositConfigToFormValues(config: z.infer<typeof depositConfigSchema>) {
  return {
    ...config,
    deposit_amount_dollars: centsToFormDollars(config.deposit_amount_cents ?? null),
  }
}

/**
 * Convert form values to deposit config
 */
export function formValuesToDepositConfig(
  formValues: z.infer<typeof depositConfigFormSchema>
): z.infer<typeof depositConfigSchema> {
  return {
    ...formValues,
    deposit_amount_cents: formDollarsToCents(formValues.deposit_amount_dollars),
  }
}

// =====================================================
// Type Exports
// =====================================================

export type DepositConfigInput = z.infer<typeof depositConfigSchema>
export type PricingConfigInput = z.infer<typeof pricingConfigSchema>
export type BookingRulesConfigInput = z.infer<typeof bookingRulesConfigSchema>
export type RateDiscountsConfigInput = z.infer<typeof rateDiscountsConfigSchema>
export type SeasonalPricingEntryInput = z.infer<typeof seasonalPricingEntrySchema>
export type SeasonalPricingTemplateInput = z.infer<typeof seasonalPricingTemplateSchema>
export type SiteSeasonalTemplateApplicationInput = z.infer<typeof siteSeasonalTemplateApplicationSchema>

export type DepositConfigFormInput = z.infer<typeof depositConfigFormSchema>
export type PricingConfigFormInput = z.infer<typeof pricingConfigFormSchema>
export type SeasonalPricingFormInput = z.infer<typeof seasonalPricingFormSchema>

export type UpdatePropertyConfigInput = z.infer<typeof updatePropertyConfigSchema>
export type UpdateSiteConfigInput = z.infer<typeof updateSiteConfigSchema>
export type BulkConfigurationApplicationInput = z.infer<typeof bulkConfigurationApplicationSchema>

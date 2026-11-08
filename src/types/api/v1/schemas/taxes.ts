/**
 * Property Taxes API v1 — Zod Schemas
 *
 * A property owes its taxes to one or more authorities, each with its own rate,
 * duration gate and effective window, so the payload describes one tax rather
 * than a rate on the property.
 *
 * The shapes here mirror the PropertyTax aggregate's invariants, which mirror
 * the database's check constraints. The aggregate is the authority; these
 * schemas exist so an obviously malformed body is rejected before it reaches it.
 */

import { z } from 'zod'

const BASIS_POINTS_MAX = 10_000

export const TaxRateTypeSchema = z.enum(['percentage', 'per_night', 'flat'])
export const TaxBasisSchema = z.enum(['pre_tax', 'compounds_on_tax'])

const isoDateNullable = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be YYYY-MM-DD' }), z.null()])
  .describe('Calendar date only (YYYY-MM-DD)')

const nightsNullable = z.union([z.number().int().min(0), z.null()])

export const CreatePropertyTaxRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),

  /** Who it is remitted to, e.g. "Ohio Department of Taxation". */
  authority: z.union([z.string().trim().max(200), z.null()]).default(null),

  rateType: TaxRateTypeSchema,

  /** Basis points, so 575 is 5.75%. Percentage taxes only. */
  rateBp: z.union([z.number().int().min(0).max(BASIS_POINTS_MAX), z.null()]).default(null),

  /** Cents per night, or once for a flat levy. Non-percentage taxes only. */
  amountCents: z.union([z.number().int().min(0), z.null()]).default(null),

  /**
   * Inclusive stay-length bounds. Ohio exempts stays of 30 nights or more, so
   * its lodging tax carries maxNights 29.
   */
  minNights: nightsNullable.default(null),
  maxNights: nightsNullable.default(null),

  basis: TaxBasisSchema.default('pre_tax'),
  priority: z.number().int().default(0),

  discountsReduceTaxableAmount: z.boolean().default(true),
  exemptible: z.boolean().default(true),

  effectiveFrom: isoDateNullable.default(null),
  effectiveTo: isoDateNullable.default(null),

  enabled: z.boolean().default(true),

  /** `tax_categories.code` values this tax charges on. At least one. */
  appliesToCategories: z.array(z.string().trim().min(1)).min(1),
})

/** Every field optional: omitted fields keep their stored value. */
export const UpdatePropertyTaxRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    authority: z.union([z.string().trim().max(200), z.null()]),
    rateType: TaxRateTypeSchema,
    rateBp: z.union([z.number().int().min(0).max(BASIS_POINTS_MAX), z.null()]),
    amountCents: z.union([z.number().int().min(0), z.null()]),
    minNights: nightsNullable,
    maxNights: nightsNullable,
    basis: TaxBasisSchema,
    priority: z.number().int(),
    discountsReduceTaxableAmount: z.boolean(),
    exemptible: z.boolean(),
    effectiveFrom: isoDateNullable,
    effectiveTo: isoDateNullable,
    enabled: z.boolean(),
    appliesToCategories: z.array(z.string().trim().min(1)).min(1),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided',
  })

export type CreatePropertyTaxRequest = z.infer<typeof CreatePropertyTaxRequestSchema>
export type UpdatePropertyTaxRequest = z.infer<typeof UpdatePropertyTaxRequestSchema>

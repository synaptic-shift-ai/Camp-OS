/**
 * Turning a priced stay into tax lines on a PriceBreakdown.
 *
 * Shared by every server path that prices a stay — the guest quote and
 * reservation creation via QuoteStayQuery, and extensions and renewals via
 * lib/booking/pricing-enhanced — so one booking and its later extension cannot
 * charge different taxes.
 *
 * The selection and arithmetic live in lib/config/tax-rules, alongside the
 * other configuration rule modules. This is only the mapping between those
 * rules and the breakdown the rest of the application reads.
 */

import { computeTaxLines, sumTaxLines } from '@/lib/config/tax-rules'
import type { TaxDefinition, TaxLine, TaxableCharge } from '@/lib/config/tax-rules'
import type { PriceBreakdown } from '@/lib/booking/types'

/**
 * The tax category a stay charge falls in.
 *
 * Configured fees ride on this same charge, governed by their own `is_taxable`
 * flag as they have been since S-0.3. Giving each fee its own tax category is a
 * settings change and belongs with the tax settings UI.
 */
export const STAY_TAX_CATEGORY = 'lodging'

/** The legacy single-rate fields a property may still be carrying. */
export type LegacyTaxConfig = {
  tax_rate?: number
  tax_name?: string
  discounts_reduce_taxable_amount?: boolean
}

/**
 * The taxes to charge a stay.
 *
 * Normally just the configured ones. The fallback bridges deployment: code can
 * reach production before the tax migration is applied, and a property that
 * still carries a rate in `pricing_config` with no `property_taxes` rows must
 * keep collecting it rather than silently stopping. A property that charges no
 * tax has a rate of 0 and is unaffected.
 *
 * REMOVE once the migration is applied everywhere — it is the second source of
 * truth this work exists to eliminate.
 */
export function resolveStayTaxes(
  configured: readonly TaxDefinition[],
  pricingConfig: LegacyTaxConfig | null | undefined,
): readonly TaxDefinition[] {
  if (configured.length > 0) return configured

  const legacyRate = typeof pricingConfig?.tax_rate === 'number' ? pricingConfig.tax_rate : 0
  if (legacyRate <= 0) return []

  return [
    {
      id: 'legacy-pricing-config-tax',
      name: pricingConfig?.tax_name?.trim() || 'Tax',
      authority: null,
      rateType: 'percentage',
      // The stored rate is a decimal fraction; a basis point is a hundredth of
      // a percent, which is also the finest granularity the settings UI offers.
      rateBp: Math.round(legacyRate * 10_000),
      amountCents: null,
      minNights: null,
      maxNights: null,
      basis: 'pre_tax',
      priority: 0,
      discountsReduceTaxableAmount: pricingConfig?.discounts_reduce_taxable_amount ?? true,
      exemptible: true,
      effectiveFrom: null,
      effectiveTo: null,
      enabled: true,
      appliesToCategories: [STAY_TAX_CATEGORY],
    },
  ]
}

/** The stay, as one taxable charge. */
export function stayTaxableCharge(args: {
  /** Stay subtotal plus the fees the property marked taxable, before discounts. */
  stayPlusTaxableFeesCents: number
  discountCents: number
  numberOfNights: number
  /** Check-in date, so a future stay is taxed at the rate effective then. */
  checkInDate: string
}): TaxableCharge {
  return {
    categoryCode: STAY_TAX_CATEGORY,
    amountCents: args.stayPlusTaxableFeesCents,
    discountCents: args.discountCents,
    nights: args.numberOfNights,
    chargeDate: args.checkInDate,
  }
}

/**
 * Put tax lines on a breakdown and return their total.
 *
 * The deprecated single-rate fields stay populated for renderers that have not
 * moved to `tax_lines` yet. With several taxes there is no one rate to report,
 * so none is reported rather than one of them being passed off as the whole.
 */
export function applyTaxLinesToBreakdown(
  breakdown: PriceBreakdown,
  taxLines: readonly TaxLine[],
): number {
  const taxes = sumTaxLines(taxLines)

  breakdown.taxes = taxes
  breakdown.tax_lines = taxLines.map((line) => ({
    tax_id: line.taxId,
    name: line.name,
    authority: line.authority,
    rate_bp: line.rateBp,
    amount_cents: line.amountCents,
    exempt: line.exempt,
  }))

  const only = taxLines.length === 1 ? taxLines[0] : undefined
  if (only) {
    breakdown.tax_name = only.name
    if (only.rateBp !== null) breakdown.tax_rate = only.rateBp / 10_000
  } else if (taxLines.length > 1) {
    breakdown.tax_name = 'Taxes'
  } else {
    breakdown.tax_rate = 0
  }

  return taxes
}

/** Resolve, select, charge and record a stay's taxes in one step. */
export function applyStayTaxes(args: {
  breakdown: PriceBreakdown
  configuredTaxes: readonly TaxDefinition[]
  pricingConfig: LegacyTaxConfig | null | undefined
  stayPlusTaxableFeesCents: number
  discountCents: number
  numberOfNights: number
  checkInDate: string
}): { taxes: number; taxLines: readonly TaxLine[] } {
  const taxLines = computeTaxLines(
    resolveStayTaxes(args.configuredTaxes, args.pricingConfig),
    stayTaxableCharge(args),
  )
  return { taxes: applyTaxLinesToBreakdown(args.breakdown, taxLines), taxLines }
}

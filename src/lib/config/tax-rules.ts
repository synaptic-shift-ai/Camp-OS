/**
 * Tax Computation Rules
 *
 * Single authority for turning a priced stay into a tax amount. Extracted
 * because tax was computed four different ways across the codebase, and two of
 * those ignored the per-fee `is_taxable` flag that configuration already
 * carries.
 *
 * Callers decide which fees are taxable (see `is_taxable` on UserDefinedFee)
 * and pass only that subtotal in `taxableFeesCents`. Keeping the split on the
 * caller side means this module never has to know about fee shapes.
 *
 * @module lib/config/tax-rules
 */

/** The configured rules that govern how tax is derived. */
export type TaxRules = {
  /** Tax rate as a decimal, e.g. 0.085 for 8.5%. */
  taxRate: number

  /**
   * Whether discounts reduce the amount tax is charged on.
   *
   * True (the default) taxes the post-discount amount. False taxes the
   * pre-discount amount, which some jurisdictions require.
   */
  discountsReduceTaxableAmount: boolean
}

/** The money that makes up a taxable base, all in integer cents. */
export type TaxableAmounts = {
  /** Stay subtotal before fees and discounts. */
  subtotalCents: number

  /** Fees the property has marked taxable. Omit or pass 0 when there are none. */
  taxableFeesCents?: number

  /** Total discount applied. Omit or pass 0 when there are none. */
  discountCents?: number
}

/**
 * The amount tax is charged on.
 *
 * Never negative: a discount larger than the taxable amount floors the base at
 * zero rather than producing negative tax.
 */
export function computeTaxableBase(amounts: TaxableAmounts, rules: TaxRules): number {
  const taxable = amounts.subtotalCents + (amounts.taxableFeesCents ?? 0)
  const base = rules.discountsReduceTaxableAmount
    ? taxable - (amounts.discountCents ?? 0)
    : taxable
  return Math.max(0, base)
}

/** Tax owed in whole cents, rounded half-up to match the rest of the pricing path. */
export function computeTax(amounts: TaxableAmounts, rules: TaxRules): number {
  if (rules.taxRate <= 0) return 0
  return Math.round(computeTaxableBase(amounts, rules) * rules.taxRate)
}

/** Parts a caller holds when it tracks one running total instead of components. */
export type RunningTotalParts = {
  /** Stay subtotal plus every fee, less discounts — the engine's running total. */
  totalBeforeTaxCents: number

  /** Every fee added to that total, taxable or not. */
  allFeesCents: number

  /** The subset of those fees the property marked taxable. */
  taxableFeesCents: number

  /** Discounts already subtracted from that total. */
  discountCents: number
}

/**
 * Recover "stay subtotal plus taxable fees" from a post-fee, post-discount
 * total, so it can be handed to {@link computeTax} as its `subtotalCents`.
 *
 * Adds discounts back because whether they reduce the taxable amount is
 * {@link computeTaxableBase}'s decision, not this one, and removes the fees the
 * property marked non-taxable.
 */
export function stayPlusTaxableFeesFromTotal(parts: RunningTotalParts): number {
  const nonTaxableFeesCents = parts.allFeesCents - parts.taxableFeesCents
  return parts.totalBeforeTaxCents + parts.discountCents - nonTaxableFeesCents
}

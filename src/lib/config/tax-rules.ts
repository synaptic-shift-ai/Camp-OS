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
export function computeTaxableBase(
  amounts: TaxableAmounts,
  rules: Pick<TaxRules, 'discountsReduceTaxableAmount'>,
): number {
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

// ============================================================================
// Multiple taxes (S-3)
//
// The functions above take one rate, which is all `pricing_config.tax_rate`
// could express. A property can owe several taxes to several authorities, each
// remitted separately, each with its own gate and effective window — so tax is
// a list of lines, not a number. Everything below is pure: a caller loads
// `property_taxes` with its applicability and hands the rows in.
// ============================================================================

/** How a tax turns a charge into an amount. */
export type TaxRateType = 'percentage' | 'per_night' | 'flat'

/** Whether a tax charges on the charge alone, or on the taxes before it. */
export type TaxBasis = 'pre_tax' | 'compounds_on_tax'

/** One configured tax, as `property_taxes` plus its `tax_applicability` rows. */
export type TaxDefinition = {
  id: string
  name: string

  /** Who it is remitted to. Carried onto every line so a total by authority is a group-by. */
  authority: string | null

  rateType: TaxRateType

  /** Basis points, so 575 is 5.75%. Set only for `percentage`. */
  rateBp: number | null

  /** Cents per night for `per_night`, or once for `flat`. Null for `percentage`. */
  amountCents: number | null

  /**
   * Inclusive stay-length bounds. Ohio exempts stays of 30 nights or more, so
   * its lodging tax carries `maxNights: 29`. Null means unbounded.
   */
  minNights: number | null
  maxNights: number | null

  basis: TaxBasis

  /** Evaluation order within a basis. Lower first. */
  priority: number

  /** Whether a discount reduces this tax's base. Per tax: authorities disagree. */
  discountsReduceTaxableAmount: boolean

  /** Whether a guest exemption certificate can waive it. */
  exemptible: boolean

  /** Inclusive ISO date bounds (yyyy-mm-dd). Null means unbounded. */
  effectiveFrom: string | null
  effectiveTo: string | null

  enabled: boolean

  /** `tax_categories.code` values this tax reaches. Empty means it taxes nothing. */
  appliesToCategories: readonly string[]
}

/** A charge to be taxed: a stay, a fee, or a store sale. */
export type TaxableCharge = {
  /** The charge's `tax_categories.code`. */
  categoryCode: string

  /** The charge before any discount, in cents. */
  amountCents: number

  /** Discount applied to this charge, in cents. Omit when there is none. */
  discountCents?: number

  /**
   * Nights the charge covers, or null when it has none — a store sale.
   * A tax with a duration gate never reaches a charge with no night count,
   * because a gate would otherwise read as "always applies" on goods.
   */
  nights: number | null

  /**
   * The charge's own date: check-in for a stay, the posting date for goods.
   * Never "today", so a stay booked in March for July is taxed at July's rate.
   */
  chargeDate: string
}

/** A guest's exemption certificate as it bears on one charge. */
export type TaxExemption = {
  /** True waives every exemptible tax; false waives only {@link TaxExemption.taxIds}. */
  exemptsAll: boolean

  /** Which taxes are waived when `exemptsAll` is false. */
  taxIds?: readonly string[]

  /** Inclusive ISO expiry. A certificate expired at the charge date waives nothing. */
  expiresOn?: string | null
}

/**
 * One tax, charged on one charge.
 *
 * The identity and rate are snapshotted here rather than looked up later, so a
 * rate change never rewrites a receipt that has already been issued.
 */
export type TaxLine = {
  taxId: string
  name: string
  authority: string | null
  rateBp: number | null

  /** Cents charged. Zero on a waived line. */
  amountCents: number

  /** True when the tax applied but a certificate waived it. */
  exempt: boolean
}

const BASIS_POINTS_PER_UNIT = 10_000

/** ISO yyyy-mm-dd dates compare correctly as strings, so no Date parsing. */
function withinInclusive(date: string, from: string | null, to: string | null): boolean {
  if (from !== null && date < from) return false
  if (to !== null && date > to) return false
  return true
}

function withinNightGate(charge: TaxableCharge, tax: TaxDefinition): boolean {
  const gated = tax.minNights !== null || tax.maxNights !== null
  if (!gated) return true
  // A charge with no nights cannot satisfy a stay-length gate, and must not be
  // treated as if the gate were absent.
  if (charge.nights === null) return false
  if (tax.minNights !== null && charge.nights < tax.minNights) return false
  if (tax.maxNights !== null && charge.nights > tax.maxNights) return false
  return true
}

const BASIS_ORDER: Record<TaxBasis, number> = { pre_tax: 0, compounds_on_tax: 1 }

/**
 * The taxes that apply to one charge, in the order they must be computed.
 *
 * `pre_tax` taxes come first so a compounding one can charge on their amounts;
 * within a basis the configured priority orders them, and equal priorities fall
 * back to id so the result never depends on the order rows were loaded in.
 */
export function selectApplicableTaxes(
  taxes: readonly TaxDefinition[],
  charge: TaxableCharge,
): TaxDefinition[] {
  return taxes
    .filter(
      (tax) =>
        tax.enabled &&
        tax.appliesToCategories.includes(charge.categoryCode) &&
        withinNightGate(charge, tax) &&
        withinInclusive(charge.chargeDate, tax.effectiveFrom, tax.effectiveTo),
    )
    .sort(
      (a, b) =>
        BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis] ||
        a.priority - b.priority ||
        a.id.localeCompare(b.id),
    )
}

function isWaivedBy(tax: TaxDefinition, charge: TaxableCharge, exemption?: TaxExemption): boolean {
  if (exemption === undefined || !tax.exemptible) return false
  // Expiry is judged at the charge date, like every other date in this module.
  if (exemption.expiresOn != null && exemption.expiresOn < charge.chargeDate) return false
  return exemption.exemptsAll || (exemption.taxIds?.includes(tax.id) ?? false)
}

function taxAmountCents(tax: TaxDefinition, charge: TaxableCharge, baseCents: number): number {
  switch (tax.rateType) {
    case 'percentage':
      return Math.round((baseCents * (tax.rateBp ?? 0)) / BASIS_POINTS_PER_UNIT)
    case 'flat':
      return tax.amountCents ?? 0
    case 'per_night': {
      if (charge.nights === null) {
        // Silently charging zero would under-collect a tax the operator still
        // owes, so this surfaces as a misconfiguration instead.
        throw new Error(
          `Tax "${tax.name}" (${tax.id}) is per_night but applies to a charge with no night count ` +
            `(category "${charge.categoryCode}"). Restrict its applicability to stay categories.`,
        )
      }
      return (tax.amountCents ?? 0) * charge.nights
    }
  }
}

/**
 * Every tax owed on one charge, one line each.
 *
 * Each line is rounded on its own, because each authority is remitted on its
 * own and its figure has to be independently correct — which differs by up to a
 * cent from rounding one combined rate.
 *
 * A tax filtered out by its gate, applicability or effective window produces no
 * line at all. A tax that applies but is waived produces a zero line marked
 * `exempt`, so the guest can see the tax was considered.
 */
export function computeTaxLines(
  taxes: readonly TaxDefinition[],
  charge: TaxableCharge,
  exemption?: TaxExemption,
): TaxLine[] {
  const lines: TaxLine[] = []
  let compoundableCents = 0

  for (const tax of selectApplicableTaxes(taxes, charge)) {
    const ownBase = computeTaxableBase(
      { subtotalCents: charge.amountCents, discountCents: charge.discountCents ?? 0 },
      { discountsReduceTaxableAmount: tax.discountsReduceTaxableAmount },
    )
    const base = tax.basis === 'compounds_on_tax' ? ownBase + compoundableCents : ownBase
    const waived = isWaivedBy(tax, charge, exemption)
    const amountCents = waived ? 0 : taxAmountCents(tax, charge, base)

    lines.push({
      taxId: tax.id,
      name: tax.name,
      authority: tax.authority,
      rateBp: tax.rateBp,
      amountCents,
      exempt: waived,
    })
    compoundableCents += amountCents
  }

  return lines
}

/** Total charged across tax lines. A waived line already carries zero. */
export function sumTaxLines(lines: readonly TaxLine[]): number {
  return lines.reduce((total, line) => total + line.amountCents, 0)
}

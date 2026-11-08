/**
 * QuoteStayQuery
 *
 * The single authority for what a guest stay costs. Both the quote endpoint and
 * reservation creation call this, so a quoted total and a charged total are
 * identical by construction rather than by two implementations agreeing.
 *
 * Extracted verbatim from app/api/guest/reservations/create/route.ts, which
 * computed pricing inline in two near-duplicate places while the booking portal
 * computed it a third time on the client from a different base.
 *
 * Pure: takes site and property configuration, touches no database. Alongside
 * the breakdown the portal renders, it returns categorised line items, which
 * the reservation folio consumes later.
 */

import { calculatePriceBreakdown, getBaseSubtotalAndLabel } from '@/lib/booking/pricing'
import type { PriceBreakdown, SiteType } from '@/lib/booking/types'
import {
  resolveRateDiscountsConfig,
  parseReservationTypesConfigFromDB,
  resolveReservationTypeRate,
  parseEnabledReservationTypesFromDB,
} from '@/lib/config/resolution'
import type {
  RateDiscountsConfig,
  SiteTypeConfig,
  SiteTypeRateBundle,
  UserDefinedFee,
} from '@/lib/config/types'
import { shouldApplyFee, computeFeeAmount } from '@/lib/config/fee-rules'
import type { FeeApplicationContext } from '@/lib/config/fee-rules'
import type { TaxDefinition } from '@/lib/config/tax-rules'
import { applyStayTaxes } from '@/modules/BookingEngine/domain/services/StayTaxLines'
import { computeDiscountAmount } from '@/lib/config/discount-rules'
import { resolveRatePeriods } from '@/lib/config/rate-periods'
import type { EffectiveRatePeriods } from '@/lib/config/rate-periods'
import { getManualOverrideTypes, getPricingSourceType } from '@/lib/site-pricing-source'

export type QuoteSite = {
  site_type: string | null
  base_price: number | null
  weekly_rate_cents: number | null
  monthly_rate_cents: number | null
  pricing_override: unknown
  enabled_reservation_types_override: unknown
}

export type QuoteProperty = {
  pricing_config: unknown
  rate_discounts_config: unknown
  reservation_type_config: unknown
  site_type_config: unknown
  enabled_reservation_types: unknown
}

export type QuoteStayInput = {
  site: QuoteSite
  property: QuoteProperty | null
  checkInDate: string
  checkOutDate: string
  numberOfNights: number
  numAdults: number
  numChildren: number
  numPets: number

  /**
   * The property's configured taxes, from `property_taxes` (S-3). Required, not
   * optional: a caller that forgot to load them would quote a stay with no tax
   * and the property would owe it anyway.
   *
   * An empty list means no tax, unless the property still carries only the
   * legacy single rate — see {@link resolveQuoteTaxes}.
   */
  taxes: readonly TaxDefinition[]
}

/** A single charge, credit or tax line. `amount` is always a positive magnitude. */
export type QuoteLineItem = {
  description: string
  amount: number
  quantity: number
  unitPrice: number
  category: 'base' | 'fee' | 'tax' | 'discount'
}

export type QuoteStayResult = {
  breakdown: PriceBreakdown
  lineItems: QuoteLineItem[]

  /**
   * Rates this quote resolved. Exposed because deposit rules need the nightly
   * rate, and callers must not resolve it a second time.
   */
  rates: { nightlyCents: number }
}

type AppliedDiscount = {
  id: string
  title: string
  amount: number
  trigger_type: 'manual' | 'min_nights' | 'min_guests' | 'date_range'
}

/**
 * Pet fee, preferring a configured `has_pets` flat-amount fee over the legacy
 * scalar. Previously duplicated in the create route and availability results.
 */
function findConfiguredPetFee(pricingConfig: unknown): UserDefinedFee | null {
  const fees = (pricingConfig as { user_defined_fees?: UserDefinedFee[] } | null)
    ?.user_defined_fees
  return (
    fees?.find(
      (fee) =>
        fee.enabled === true &&
        fee.trigger_type === 'has_pets' &&
        fee.fee_type === 'flat_amount' &&
        typeof fee.value_cents === 'number' &&
        fee.value_cents >= 0,
    ) ?? null
  )
}

export function resolveGuestPetFeeCents(pricingConfig: unknown): number {
  const configuredPetFee = findConfiguredPetFee(pricingConfig)
  if (configuredPetFee?.value_cents != null) return configuredPetFee.value_cents

  const legacy = (pricingConfig as { pet_fee_cents?: number } | null)?.pet_fee_cents
  if (typeof legacy === 'number' && legacy >= 0) return legacy
  return 0
}

/**
 * Effective nightly, weekly and monthly rates for a site.
 *
 * Which source wins depends on the site's pricing source: `manual` uses the
 * site's own rates, `site_type_default` uses the property's per-site-type
 * rates, and `property_default` uses the property reservation-type config.
 */
/** The property's per-site-type rate bundle for this site, if any. */
function findSiteTypeBundle(
  site: QuoteSite,
  property: QuoteProperty | null,
): SiteTypeRateBundle | null {
  const map = (property?.site_type_config as SiteTypeConfig | null)?.site_type_rates ?? {}
  const siteType = (site.site_type ?? '').toLowerCase()
  const key = Object.keys(map).find((k) => k.toLowerCase() === siteType) ?? (site.site_type ?? '')
  return key ? (map[key] ?? null) : null
}

function resolveEffectiveRates(
  site: QuoteSite,
  property: QuoteProperty | null,
  periods: EffectiveRatePeriods,
) {
  const reservationTypeConfig = parseReservationTypesConfigFromDB(
    property?.reservation_type_config ?? null,
  )
  const pricingSource = getPricingSourceType(
    site.pricing_override,
    site.enabled_reservation_types_override,
  )
  const usesManual = pricingSource === 'manual'
  const usesSiteTypeDefault = pricingSource === 'site_type_default'

  let siteTypeHasWeekly = false
  let siteTypeHasMonthly = false
  let effectiveOverride:
    | Partial<Record<'nightly' | 'weekly' | 'monthly' | 'seasonal', number>>
    | null = null

  if (usesSiteTypeDefault) {
    const rates = findSiteTypeBundle(site, property)
    if (rates) {
      siteTypeHasWeekly = rates.weekly?.rate_cents != null && rates.weekly.rate_cents > 0
      siteTypeHasMonthly = rates.monthly?.rate_cents != null && rates.monthly.rate_cents > 0
      effectiveOverride = {}
      if (rates.nightly?.rate_cents != null) effectiveOverride.nightly = rates.nightly.rate_cents
      if (rates.weekly?.rate_cents != null) effectiveOverride.weekly = rates.weekly.rate_cents
      if (rates.monthly?.rate_cents != null) effectiveOverride.monthly = rates.monthly.rate_cents
      if (rates.seasonal?.rate_cents != null) effectiveOverride.seasonal = rates.seasonal.rate_cents
    }
  } else if (usesManual) {
    effectiveOverride = { nightly: site.base_price ?? 0 }
  }

  const fallbackRates = {
    base_price: site.base_price ?? 0,
    weekly_rate_cents: usesManual ? (site.weekly_rate_cents ?? null) : null,
    monthly_rate_cents: usesManual ? (site.monthly_rate_cents ?? null) : null,
  }

  const nightly = resolveReservationTypeRate(
    'nightly',
    reservationTypeConfig,
    effectiveOverride,
    fallbackRates,
  )
  const weekly = resolveReservationTypeRate(
    'weekly',
    reservationTypeConfig,
    effectiveOverride,
    fallbackRates,
  )
  const monthly = resolveReservationTypeRate(
    'monthly',
    reservationTypeConfig,
    effectiveOverride,
    fallbackRates,
  )

  const propertyEnabledTypes = parseEnabledReservationTypesFromDB(
    property?.enabled_reservation_types,
  )
  const manualTypes = getManualOverrideTypes(
    site.pricing_override,
    site.enabled_reservation_types_override,
  )
  const weeklyEnabled = usesManual
    ? (manualTypes?.includes('weekly') ?? false)
    : usesSiteTypeDefault
      ? siteTypeHasWeekly || propertyEnabledTypes.includes('weekly')
      : propertyEnabledTypes.includes('weekly')
  const monthlyEnabled = usesManual
    ? (manualTypes?.includes('monthly') ?? false)
    : usesSiteTypeDefault
      ? siteTypeHasMonthly || propertyEnabledTypes.includes('monthly')
      : propertyEnabledTypes.includes('monthly')

  return {
    nightly,
    // A rate equal to nightly x the configured block length means "no distinct
    // block rate", which getBaseSubtotalAndLabel signals with null. Preserved
    // as-is: a property whose weekly rate happens to equal 7x nightly is
    // therefore labelled nightly, which is the long-standing behaviour.
    weeklyForLabel: weeklyEnabled ? weekly : nightly * periods.weekly.minNights,
    monthlyForLabel: monthlyEnabled ? monthly : nightly * periods.monthly.minNights,
  }
}

/**
 * Discounts that apply automatically to a guest booking.
 *
 * `manual` discounts are excluded: a guest cannot select one. Amounts come from
 * lib/config/discount-rules, shared with the staff pricing paths.
 */
function resolveAutoDiscounts(
  property: QuoteProperty | null,
  args: {
    checkInDate: string
    numberOfNights: number
    totalGuests: number
    subtotalCents: number
    feeInclusiveBaseCents: number
  },
): { applied: AppliedDiscount[]; totalCents: number } {
  const rateDiscountsConfig = resolveRateDiscountsConfig(
    (property?.rate_discounts_config as RateDiscountsConfig | null) ?? null,
  )
  const userDiscounts = rateDiscountsConfig.user_defined_discounts ?? []
  const applied: AppliedDiscount[] = []
  let totalCents = 0

  const inDateRange = (start: string | undefined, end: string | undefined) => {
    if (start && args.checkInDate < start) return false
    if (end && args.checkInDate > end) return false
    return true
  }

  for (const discount of userDiscounts) {
    if (!discount.enabled || discount.trigger_type === 'manual') continue

    let shouldApply = false
    if (discount.trigger_type === 'date_range') {
      shouldApply = inDateRange(
        discount.trigger_conditions?.start_date,
        discount.trigger_conditions?.end_date,
      )
    } else if (discount.trigger_type === 'min_nights') {
      shouldApply = args.numberOfNights >= (discount.trigger_conditions?.min_nights ?? 0)
    } else if (discount.trigger_type === 'min_guests') {
      shouldApply = args.totalGuests >= (discount.trigger_conditions?.min_guests ?? 0)
    }
    if (!shouldApply) continue

    const amount = computeDiscountAmount(discount, {
      subtotalCents: args.subtotalCents,
      totalBaseCents: args.feeInclusiveBaseCents,
    })

    if (amount > 0) {
      applied.push({
        id: discount.id,
        title: discount.title ?? 'Discount',
        amount,
        trigger_type: discount.trigger_type,
      })
      totalCents += amount
    }
  }

  return { applied, totalCents }
}

/** A database row, loosely typed: callers pass what their select returned. */
type Row = Record<string, unknown>

/**
 * Build a {@link QuoteStayInput} from a site row and a property row.
 *
 * Every caller that prices a stay must use this, so the quote endpoint and
 * reservation creation read the same configuration out of the same columns.
 * The mapping was previously written three times; adding a configuration field
 * to one copy and not the others would have made a quoted total diverge from a
 * charged one silently.
 */
export function toQuoteStayInput(args: {
  site: Row
  property: Row | null
  checkInDate: string
  checkOutDate: string
  numberOfNights: number
  numAdults: number
  numChildren: number
  numPets: number
  /** From `SupabasePropertyTaxRepository.findByPropertyId`, mapped with `toTaxDefinition()`. */
  taxes: readonly TaxDefinition[]
}): QuoteStayInput {
  const { site, property } = args
  return {
    site: {
      site_type: (site.site_type as string | null) ?? null,
      base_price: (site.base_price as number | null) ?? null,
      weekly_rate_cents: (site.weekly_rate_cents as number | null) ?? null,
      monthly_rate_cents: (site.monthly_rate_cents as number | null) ?? null,
      pricing_override: site.pricing_override ?? null,
      enabled_reservation_types_override: site.enabled_reservation_types_override ?? null,
    },
    property: property
      ? {
          pricing_config: property.pricing_config ?? null,
          rate_discounts_config: property.rate_discounts_config ?? null,
          reservation_type_config: property.reservation_type_config ?? null,
          site_type_config: property.site_type_config ?? null,
          enabled_reservation_types: property.enabled_reservation_types ?? null,
        }
      : null,
    checkInDate: args.checkInDate,
    checkOutDate: args.checkOutDate,
    numberOfNights: args.numberOfNights,
    numAdults: args.numAdults,
    numChildren: args.numChildren,
    numPets: args.numPets,
    taxes: args.taxes,
  }
}

/** Quote a guest stay. Pure; the caller supplies the site and property rows. */
export function quoteStay(input: QuoteStayInput): QuoteStayResult {
  const { site, property, numberOfNights } = input

  // Rate-period thresholds come from configuration: per-site-type, then
  // property, then defaults (S-0.4).
  const periods = resolveRatePeriods(
    parseReservationTypesConfigFromDB(property?.reservation_type_config ?? null),
    findSiteTypeBundle(site, property),
  )
  const rates = resolveEffectiveRates(site, property, periods)

  const { subtotalCents, basePriceLabel, rateType } = getBaseSubtotalAndLabel(
    numberOfNights,
    rates.nightly,
    rates.weeklyForLabel !== rates.nightly * periods.weekly.minNights
      ? rates.weeklyForLabel
      : null,
    rates.monthlyForLabel !== rates.nightly * periods.monthly.minNights
      ? rates.monthlyForLabel
      : null,
    periods,
  )

  const breakdown = calculatePriceBreakdown({
    basePricePerNight: rates.nightly,
    numberOfNights,
    siteType: (site.site_type ?? 'other') as SiteType,
    numPets: input.numPets,
    petFeeCentsOverride: resolveGuestPetFeeCents(property?.pricing_config ?? null),
  })
  breakdown.subtotal = subtotalCents
  breakdown.base_price_label = basePriceLabel
  breakdown.rate_type = rateType
  breakdown.total = subtotalCents + (breakdown.pet_fee ?? 0)

  const pricingConfig =
    (property?.pricing_config as {
      tax_rate?: number
      tax_name?: string
      discounts_reduce_taxable_amount?: boolean
      user_defined_fees?: UserDefinedFee[]
    } | null) ?? {}


  // The property's configured fees, replacing the hardcoded cabin cleaning fee
  // and 10% service fee. Eligibility and amount both come from lib/config/fee-rules,
  // shared with the staff pricing paths.
  const totalGuests = input.numAdults + input.numChildren
  const feeContext: FeeApplicationContext = {
    totalNights: numberOfNights,
    totalGuests,
    numPets: input.numPets,
    checkInDate: input.checkInDate,
    siteType: site.site_type,
    // A guest cannot select a manual fee, so none are auto-applied.
    selectedFeeIds: [],
  }

  const appliedFees: NonNullable<PriceBreakdown['user_fees']> = []
  let feesTotalCents = 0
  let taxableFeesCents = 0

  // The pet fee has its own breakdown field so the portal can show it beside
  // the pet count, and calculatePriceBreakdown has already applied it. Skipping
  // it here keeps it from being charged twice.
  const petFeeId = findConfiguredPetFee(property?.pricing_config ?? null)?.id ?? null

  for (const fee of pricingConfig.user_defined_fees ?? []) {
    if (fee.id === petFeeId) continue
    if (!shouldApplyFee(fee, feeContext)) continue
    const amount = computeFeeAmount(fee, {
      subtotalCents,
      totalNights: numberOfNights,
      totalGuests,
      // "percentage of total" means the subtotal plus fees applied before it,
      // so fees are processed in configured order.
      percentageBaseCents: subtotalCents + feesTotalCents,
    })
    if (amount <= 0) continue

    appliedFees.push({ id: fee.id, title: fee.title, amount, is_taxable: fee.is_taxable })
    feesTotalCents += amount
    if (fee.is_taxable) taxableFeesCents += amount
  }
  if (appliedFees.length > 0) {
    breakdown.user_fees = appliedFees
  }

  const discounts = resolveAutoDiscounts(property, {
    checkInDate: input.checkInDate,
    numberOfNights,
    totalGuests,
    subtotalCents,
    feeInclusiveBaseCents: subtotalCents + feesTotalCents,
  })
  if (discounts.applied.length > 0) {
    breakdown.user_discounts = discounts.applied
  }

  // Each tax is selected and charged on its own: its own gate, its own
  // effective window, its own view of whether discounts reduce its base, and
  // its own rounding — because each is remitted to its own authority (S-3).
  // Shared with the extension and renewal path so the two cannot diverge.
  const { taxes, taxLines } = applyStayTaxes({
    breakdown,
    configuredTaxes: input.taxes,
    pricingConfig,
    stayPlusTaxableFeesCents: subtotalCents + taxableFeesCents,
    discountCents: discounts.totalCents,
    numberOfNights,
    checkInDate: input.checkInDate,
  })
  breakdown.total_before_tax = subtotalCents + feesTotalCents - discounts.totalCents
  breakdown.total =
    subtotalCents + feesTotalCents - discounts.totalCents + taxes + (breakdown.pet_fee ?? 0)

  const lineItems: QuoteLineItem[] = [
    {
      description: basePriceLabel,
      category: 'base',
      quantity: numberOfNights,
      unitPrice: rates.nightly,
      amount: subtotalCents,
    },
  ]
  if ((breakdown.pet_fee ?? 0) > 0) {
    lineItems.push({
      description: 'Pet fee',
      category: 'fee',
      quantity: 1,
      unitPrice: breakdown.pet_fee as number,
      amount: breakdown.pet_fee as number,
    })
  }
  for (const fee of appliedFees) {
    lineItems.push({
      description: fee.title,
      category: 'fee',
      quantity: 1,
      unitPrice: fee.amount,
      amount: fee.amount,
    })
  }
  for (const discount of discounts.applied) {
    lineItems.push({
      description: discount.title,
      category: 'discount',
      quantity: 1,
      unitPrice: discount.amount,
      amount: discount.amount,
    })
  }
  // One line per tax, so the folio and the receipt can total by authority.
  // A waived line is kept at zero: the guest should see the tax was considered.
  for (const line of taxLines) {
    lineItems.push({
      description: line.authority ? `${line.name} (${line.authority})` : line.name,
      category: 'tax',
      quantity: 1,
      unitPrice: line.amountCents,
      amount: line.amountCents,
    })
  }

  return { breakdown, lineItems, rates: { nightlyCents: rates.nightly } }
}

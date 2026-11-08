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
import { DEFAULT_TAX_RATE } from '@/lib/booking/types'
import type { PriceBreakdown, SiteType } from '@/lib/booking/types'
import {
  resolveRateDiscountsConfig,
  parseReservationTypesConfigFromDB,
  resolveReservationTypeRate,
  parseEnabledReservationTypesFromDB,
} from '@/lib/config/resolution'
import type { RateDiscountsConfig, SiteTypeConfig, SiteTypeRateBundle } from '@/lib/config/types'
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
export function resolveGuestPetFeeCents(pricingConfig: unknown): number {
  const cfg = pricingConfig as {
    pet_fee_cents?: number
    user_defined_fees?: Array<{
      enabled?: boolean
      trigger_type?: string
      fee_type?: string
      value_cents?: number | null
    }>
  } | null

  const configuredPetFee = cfg?.user_defined_fees?.find(
    (fee) =>
      fee.enabled === true &&
      fee.trigger_type === 'has_pets' &&
      fee.fee_type === 'flat_amount' &&
      typeof fee.value_cents === 'number' &&
      fee.value_cents >= 0,
  )
  if (configuredPetFee?.value_cents != null) return configuredPetFee.value_cents
  if (typeof cfg?.pet_fee_cents === 'number' && cfg.pet_fee_cents >= 0) {
    return cfg.pet_fee_cents
  }
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
 * `manual` discounts are excluded: a guest cannot select one. `percentage_of_total`
 * is charged against a fee-inclusive base, unlike `percentage_of_subtotal`.
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

    let amount = 0
    if (
      discount.discount_type === 'percentage_of_subtotal' ||
      discount.discount_type === 'percentage_of_total'
    ) {
      const pct = (discount.value_percentage ?? 0) / 100
      const base =
        discount.discount_type === 'percentage_of_total'
          ? args.feeInclusiveBaseCents
          : args.subtotalCents
      amount = Math.round(base * pct)
      if ((discount.max_discount_cents ?? 0) > 0) {
        amount = Math.min(amount, discount.max_discount_cents as number)
      }
    } else if (discount.discount_type === 'flat_amount') {
      amount = discount.value_cents ?? 0
    }

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

  // NOTE (S-0.6): these two are reported for display but excluded from the
  // total below, so the portal quotes more than the server charges. They become
  // the property's configured fees in S-0.6; preserved verbatim here because
  // this step is an extraction, not a behaviour change.
  const cleaningFeeCents = site.site_type === 'cabin' ? 5000 : 0
  const serviceFeeCents = Math.round(subtotalCents * 0.1)
  breakdown.cleaningFee = cleaningFeeCents
  breakdown.serviceFee = serviceFeeCents

  const feeInclusiveBaseCents = subtotalCents + cleaningFeeCents + serviceFeeCents

  const pricingConfig =
    (property?.pricing_config as { tax_rate?: number; tax_name?: string } | null) ?? {}
  // NOTE (S-0.6): the hardcoded fallback goes away once tax is required config.
  const taxRate =
    typeof pricingConfig.tax_rate === 'number' && pricingConfig.tax_rate >= 0
      ? pricingConfig.tax_rate
      : DEFAULT_TAX_RATE
  breakdown.tax_rate = taxRate
  if (pricingConfig.tax_name) breakdown.tax_name = pricingConfig.tax_name

  const discounts = resolveAutoDiscounts(property, {
    checkInDate: input.checkInDate,
    numberOfNights,
    totalGuests: input.numAdults + input.numChildren,
    subtotalCents,
    feeInclusiveBaseCents,
  })
  if (discounts.applied.length > 0) {
    breakdown.user_discounts = discounts.applied
  }

  const taxes = Math.round((subtotalCents - discounts.totalCents) * taxRate)
  breakdown.taxes = taxes
  breakdown.total_before_tax = subtotalCents - discounts.totalCents
  breakdown.total = subtotalCents - discounts.totalCents + taxes + (breakdown.pet_fee ?? 0)

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
  for (const discount of discounts.applied) {
    lineItems.push({
      description: discount.title,
      category: 'discount',
      quantity: 1,
      unitPrice: discount.amount,
      amount: discount.amount,
    })
  }
  if (taxes > 0) {
    lineItems.push({
      description: breakdown.tax_name ?? 'Tax',
      category: 'tax',
      quantity: 1,
      unitPrice: taxes,
      amount: taxes,
    })
  }

  return { breakdown, lineItems, rates: { nightlyCents: rates.nightly } }
}

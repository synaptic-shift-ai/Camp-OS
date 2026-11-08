/**
 * Fee Application Rules
 *
 * Decides whether a configured fee applies to a given reservation. Extracted
 * so the server pricing engine (lib/booking/pricing-enhanced.ts) and the staff
 * pricing summary share one rule set; they previously held separate inline
 * switches that had drifted apart.
 *
 * @module lib/config/fee-rules
 */

import type { UserDefinedFee } from './types'

/**
 * Everything a fee rule may need to decide. Callers that cannot supply a value
 * pass null rather than a placeholder, so an undecidable rule declines instead
 * of charging on a guess.
 */
export type FeeApplicationContext = {
  /** Nights in the stay. */
  totalNights: number

  /** Adults plus children. */
  totalGuests: number

  /** Pets on the reservation. */
  numPets: number

  /** Check-in date (YYYY-MM-DD), or null when not yet chosen. */
  checkInDate: string | null

  /** The site's type, or null when unknown. */
  siteType: string | null

  /**
   * Ids of `manual` fees staff explicitly selected. Omit or pass an empty array
   * on paths where manual fees are never auto-applied, such as guest booking.
   */
  selectedFeeIds?: readonly string[]
}

type ScopedFee = Pick<UserDefinedFee, 'applies_to_site_types'>

/**
 * Whether a fee's site-type scope covers this site.
 *
 * An absent or empty scope means every site type. Matching is case-insensitive
 * because the setup wizard historically wrote capitalised values into
 * `site_type_config.allowed_site_types`.
 */
export function feeAppliesToSiteType(fee: ScopedFee, siteType: string | null): boolean {
  const scope = fee.applies_to_site_types
  if (!scope || scope.length === 0) return true
  if (!siteType) return false
  const normalized = siteType.trim().toLowerCase()
  return scope.some((type) => type.trim().toLowerCase() === normalized)
}

/**
 * Whether a fee's trigger condition is met.
 *
 * An unrecognised trigger type declines. Declining is the safe direction for a
 * guest-facing charge: a rule we cannot evaluate must not add money to a total.
 */
export function feeTriggerMatches(fee: UserDefinedFee, context: FeeApplicationContext): boolean {
  switch (fee.trigger_type || 'always') {
    case 'always':
      return true

    case 'manual':
      return (context.selectedFeeIds ?? []).includes(fee.id)

    case 'min_nights':
      return context.totalNights >= (fee.trigger_conditions?.min_nights ?? 0)

    case 'min_guests':
      return context.totalGuests >= (fee.trigger_conditions?.min_guests ?? 0)

    case 'has_pets':
      return context.numPets > 0

    case 'date_range': {
      const { start_date, end_date } = fee.trigger_conditions ?? {}
      // No window configured means the window is unbounded.
      if (start_date == null && end_date == null) return true
      if (!context.checkInDate) return false
      const checkIn = new Date(context.checkInDate)
      const start = start_date ? new Date(start_date) : null
      const end = end_date ? new Date(end_date) : null
      return (!start || checkIn >= start) && (!end || checkIn <= end)
    }

    default:
      return false
  }
}

/** Whether a fee is enabled, triggered, and in scope for this site type. */
export function shouldApplyFee(fee: UserDefinedFee, context: FeeApplicationContext): boolean {
  if (!fee.enabled) return false
  if (!feeAppliesToSiteType(fee, context.siteType)) return false
  return feeTriggerMatches(fee, context)
}

/** What a fee amount may be computed from, all in integer cents or counts. */
export type FeeAmountContext = {
  /** Stay subtotal before fees and discounts. */
  subtotalCents: number

  /** Nights in the stay. */
  totalNights: number

  /** Adults plus children. */
  totalGuests: number

  /**
   * Base for `percentage_of_total`. The caller decides what "total" means —
   * typically the subtotal plus fees already applied — so the policy stays at
   * the call site rather than being assumed here.
   */
  percentageBaseCents: number
}

/**
 * The amount a fee charges, in cents.
 *
 * Eligibility is a separate question; see {@link shouldApplyFee}. A missing
 * configured value yields zero rather than NaN.
 */
export function computeFeeAmount(
  fee: Pick<UserDefinedFee, 'fee_type' | 'value_cents' | 'value_percentage'>,
  context: FeeAmountContext,
): number {
  const cents = fee.value_cents ?? 0
  const percentage = (fee.value_percentage ?? 0) / 100

  switch (fee.fee_type) {
    case 'flat_amount':
      return cents
    case 'per_night':
      return cents * context.totalNights
    case 'per_guest':
      return cents * context.totalGuests
    case 'per_guest_per_night':
      return cents * context.totalGuests * context.totalNights
    case 'percentage_of_subtotal':
      return Math.round(context.subtotalCents * percentage)
    case 'percentage_of_total':
      return Math.round(context.percentageBaseCents * percentage)
    default:
      return 0
  }
}

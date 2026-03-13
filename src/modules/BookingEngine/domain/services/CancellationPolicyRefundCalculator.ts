import { startOfDay } from "date-fns"

const DEFAULT_REFUND_PERCENTAGE = 50

/**
 * One tier from cancellation_policy_config.refund_tiers.
 *
 * Semantics (matches dashboard copy):
 * - refund_percentage > 0 → "Eligible for X% refund if the cancellation is made at least N days before check-in."
 *   (i.e. minimum days-before threshold; applies when daysBeforeCheckIn >= days_before_reservation)
 * - refund_percentage = 0 → "Not eligible for any refund if the cancellation is made within N days of check-in."
 *   (i.e. non-refundable window; applies when daysBeforeCheckIn <= days_before_reservation)
 */
export type RefundTier = {
  id: string
  refund_percentage: number
  days_before_reservation: number
}

export type CancellationPolicyInput = {
  /**
   * Structured cancellation rules; if present, they are the sole input to the refund calculator.
   *
   * Behaviour (covers scenarios 1–6):
   * - Tier with refund_percentage = 0:
   *   Non-refundable window "within N days of check-in" → applies when daysBeforeCheckIn <= N.
   *   If multiple such tiers exist, the largest N defines the outer non-refundable boundary.
   *
   * - Tiers with refund_percentage > 0:
   *   Minimum days-before thresholds → applies when daysBeforeCheckIn >= N.
   *   When multiple thresholds match, the one with the largest N (closest to check-in while still in advance) wins.
   *
   * - Combined behaviour:
   *   • If any 0%-refund tier and any >0%-refund tier exist:
   *     - days <= maxNonRefundableDays → 0% refund
   *     - days >= some positive threshold → use the matching positive tier (largest days_before_reservation <= days)
   *     - days between maxNonRefundableDays and the first positive threshold → DEFAULT_REFUND_PERCENTAGE (50%) refund
   *
   *   • If only >0%-refund tiers exist:
   *     - days < smallest positive threshold → 0% refund (non-refundable)
   *
   *   • If only 0%-refund tiers exist:
   *     - days <= maxNonRefundableDays → 0% refund
   *     - days > maxNonRefundableDays → 100% refund
   */
  refund_tiers?: RefundTier[] | null | undefined
}

export function computeRefundCentsFromCancellationPolicy(
  checkInDate: Date,
  cancellationDate: Date,
  paidAmountCents: number,
  policy: CancellationPolicyInput
): number {
  if (paidAmountCents <= 0) return 0

  const checkInOnly = startOfDay(checkInDate)
  const cancelOnly = startOfDay(cancellationDate)
  const daysBeforeCheckIn = Math.floor((checkInOnly.getTime() - cancelOnly.getTime()) / 86400000)

  if (daysBeforeCheckIn <= 0) return 0

  // Refund tiers from cancellation_policy_config.
  // If present, they are used first and legacy settings-based behaviour is skipped.
  const tiers = policy.refund_tiers ?? []
  if (tiers.length > 0) {
    const positiveTiers = tiers.filter((t) => t.refund_percentage > 0)
    const nonRefundTiers = tiers.filter((t) => t.refund_percentage <= 0)

    const hasPositive = positiveTiers.length > 0
    const hasNonRefund = nonRefundTiers.length > 0

    const maxNonRefundDays = hasNonRefund
      ? Math.max(...nonRefundTiers.map((t) => t.days_before_reservation))
      : 0

    // 1) Explicit non-refundable window(s): "within N days of check-in"
    if (hasNonRefund && daysBeforeCheckIn <= maxNonRefundDays) {
      return 0
    }

    // 2) Positive tiers: "at least N days before check-in"
    let positivePercentage: number | null = null
    if (hasPositive) {
      const applicablePositive = positiveTiers
        .filter((t) => daysBeforeCheckIn >= t.days_before_reservation)
        .sort((a, b) => b.days_before_reservation - a.days_before_reservation)[0]

      if (applicablePositive != null) {
        positivePercentage = applicablePositive.refund_percentage
      }
    }

    if (positivePercentage != null) {
      const pct = Math.min(100, Math.max(0, positivePercentage))
      return Math.round((paidAmountCents * pct) / 100)
    }

    // 3) No positive tier matches at this daysBeforeCheckIn – handle gaps based on what is configured.
    if (hasPositive && hasNonRefund) {
      // Gap between non-refundable window and first positive tier:
      // treat as DEFAULT_REFUND_PERCENTAGE (50%) refund.
      const pct = DEFAULT_REFUND_PERCENTAGE
      return Math.round((paidAmountCents * pct) / 100)
    }

    if (hasPositive && !hasNonRefund) {
      // Only positive tiers configured → below the smallest threshold is non-refundable.
      return 0
    }

    if (!hasPositive && hasNonRefund) {
      // Only non-refundable tiers configured → above that window is fully refundable.
      return paidAmountCents
    }

    // If we somehow reached here with tiers configured, default to no refund.
    return 0
  }
  return 0
}
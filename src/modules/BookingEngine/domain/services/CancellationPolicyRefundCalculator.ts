import { startOfDay } from "date-fns"

const DEFAULT_REFUND_PERCENTAGE = 50

export type CancellationPolicyInput = {
    freeCancellationWindow: number | null
    refundEligiblePeriod: string | null
    cancellationRefundPercentage: number | null
    cancellationNonRefundableDays: number | null
}

function parseRefundEligiblePeriod(
    refundEligiblePeriod: string | null
  ): { minDays: number; maxDays: number } | null {
    if (refundEligiblePeriod == null || refundEligiblePeriod.trim() === "") return null
    const parts = refundEligiblePeriod.split("-").map((s) => parseInt(s.trim(), 10))
    const first = parts[0]
    if (first === undefined || Number.isNaN(first)) return null
    const minDays = first
    const second = parts[1]
    const maxDays = second !== undefined && !Number.isNaN(second) ? second : minDays
    return { minDays, maxDays }
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

    if (
        policy.freeCancellationWindow == null && 
        policy.refundEligiblePeriod == null &&
        policy.cancellationRefundPercentage == null &&
        policy.cancellationNonRefundableDays == null
    ) {
        return paidAmountCents
    }

    const eligibleRange = parseRefundEligiblePeriod(policy.refundEligiblePeriod)

    // for free cancellation window: full refund
    if (policy.freeCancellationWindow != null && daysBeforeCheckIn >= policy.freeCancellationWindow) {
        return paidAmountCents
    }

    if (
        eligibleRange != null &&
        policy.freeCancellationWindow == null &&
        daysBeforeCheckIn > eligibleRange.maxDays
    ) {
        return paidAmountCents
    }

    // Scenario 3: only cancellationNonRefundableDays set → above that = full refund
    if (
        policy.cancellationNonRefundableDays != null &&
        policy.freeCancellationWindow == null &&
        daysBeforeCheckIn > policy.cancellationNonRefundableDays
    ) {
        return paidAmountCents
    }

    // non-refundable window: no refund
    if (policy.cancellationNonRefundableDays != null && daysBeforeCheckIn <= policy.cancellationNonRefundableDays) {
        return 0
    }

    if (
        eligibleRange != null &&
        policy.cancellationNonRefundableDays == null &&
        daysBeforeCheckIn < eligibleRange.minDays
    ) {
    return 0
    }

    // refund eligible period: refund by percentage
    if (eligibleRange != null && daysBeforeCheckIn >= eligibleRange.minDays && daysBeforeCheckIn <= eligibleRange.maxDays) {
        const pct =
          policy.cancellationRefundPercentage != null
            ? Math.min(100, Math.max(0, policy.cancellationRefundPercentage))
            : DEFAULT_REFUND_PERCENTAGE
        return Math.round((paidAmountCents * pct) / 100)
    }

    // Scenario 2 & 4: inferred gap below free window → 50% when refundEligiblePeriod not set
    if (
        policy.freeCancellationWindow != null &&
        eligibleRange == null &&
        daysBeforeCheckIn < policy.freeCancellationWindow
    ) {
        const inGap =
            policy.cancellationNonRefundableDays != null
                ? daysBeforeCheckIn > policy.cancellationNonRefundableDays
                : daysBeforeCheckIn >= 1
        if (inGap) {
            const pct =
                policy.cancellationRefundPercentage != null
                    ? Math.min(100, Math.max(0, policy.cancellationRefundPercentage))
                    : DEFAULT_REFUND_PERCENTAGE
            return Math.round((paidAmountCents * pct) / 100)
        }
    }

    return 0
}
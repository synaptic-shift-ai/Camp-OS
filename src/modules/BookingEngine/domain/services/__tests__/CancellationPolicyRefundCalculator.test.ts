import { describe, test, expect } from 'vitest'
import { computeRefundCentsFromCancellationPolicy, type RefundTier } from '../CancellationPolicyRefundCalculator'

const PAID_CENTS = 10_000 // $100.00

const makeDates = (daysBeforeCheckIn: number): { checkInDate: Date; cancellationDate: Date } => {
  const cancellationDate = new Date('2024-01-01T00:00:00Z')
  const checkInDate = new Date(cancellationDate)
  checkInDate.setDate(checkInDate.getDate() + daysBeforeCheckIn)
  return { checkInDate, cancellationDate }
}

const computeRefund = (daysBeforeCheckIn: number, refund_tiers: RefundTier[]) => {
  const { checkInDate, cancellationDate } = makeDates(daysBeforeCheckIn)
  return computeRefundCentsFromCancellationPolicy(checkInDate, cancellationDate, PAID_CENTS, {
    refund_tiers,
  })
}

describe('computeRefundCentsFromCancellationPolicy - refund_tiers scenarios', () => {
  test('scenario 1: 100% at 7 days, 50% at 5 days, non-refundable within 2 days', () => {
    const tiers: RefundTier[] = [
      { id: 't1', refund_percentage: 100, days_before_reservation: 7 },
      { id: 't2', refund_percentage: 50, days_before_reservation: 5 },
      { id: 't3', refund_percentage: 0, days_before_reservation: 2 },
    ]

    // 1–2 days before: non-refundable
    expect(computeRefund(1, tiers)).toBe(0)
    expect(computeRefund(2, tiers)).toBe(0)

    // 3–4 days before: 50% refund (gap between non-refundable and first positive tier)
    expect(computeRefund(3, tiers)).toBe(5_000)
    expect(computeRefund(4, tiers)).toBe(5_000)

    // 5–6 days before: 50% refund (explicit 50% tier)
    expect(computeRefund(5, tiers)).toBe(5_000)
    expect(computeRefund(6, tiers)).toBe(5_000)

    // 7+ days before: 100% refund
    expect(computeRefund(7, tiers)).toBe(10_000)
    expect(computeRefund(8, tiers)).toBe(10_000)
  })

  test('scenario 2: only 100% at 7 days → below is non-refundable', () => {
    const tiers: RefundTier[] = [
      { id: 't1', refund_percentage: 100, days_before_reservation: 7 },
    ]

    // 1–6 days before: non-refundable
    expect(computeRefund(1, tiers)).toBe(0)
    expect(computeRefund(6, tiers)).toBe(0)

    // 7+ days before: 100% refund
    expect(computeRefund(7, tiers)).toBe(10_000)
    expect(computeRefund(8, tiers)).toBe(10_000)
  })

  test('scenario 3: only non-refundable within 3 days → above is full refund', () => {
    const tiers: RefundTier[] = [
      { id: 't1', refund_percentage: 0, days_before_reservation: 3 },
    ]

    // 1–3 days before: non-refundable
    expect(computeRefund(1, tiers)).toBe(0)
    expect(computeRefund(3, tiers)).toBe(0)

    // 4+ days before: 100% refund
    expect(computeRefund(4, tiers)).toBe(10_000)
    expect(computeRefund(10, tiers)).toBe(10_000)
  })

  test('scenario 4: only 50% at 4 days → below is non-refundable, above is 50%', () => {
    const tiers: RefundTier[] = [
      { id: 't1', refund_percentage: 50, days_before_reservation: 4 },
    ]

    // 1–3 days before: non-refundable
    expect(computeRefund(1, tiers)).toBe(0)
    expect(computeRefund(3, tiers)).toBe(0)

    // 4+ days before: 50% refund
    expect(computeRefund(4, tiers)).toBe(5_000)
    expect(computeRefund(7, tiers)).toBe(5_000)
  })

  test('scenario 5: 100% at 7 days, non-refundable within 3 days → gap is 50%', () => {
    const tiers: RefundTier[] = [
      { id: 't1', refund_percentage: 100, days_before_reservation: 7 },
      { id: 't2', refund_percentage: 0, days_before_reservation: 3 },
    ]

    // 1–3 days before: non-refundable
    expect(computeRefund(1, tiers)).toBe(0)
    expect(computeRefund(3, tiers)).toBe(0)

    // 4–6 days before: 50% refund (inferred gap)
    expect(computeRefund(4, tiers)).toBe(5_000)
    expect(computeRefund(6, tiers)).toBe(5_000)

    // 7+ days before: 100% refund
    expect(computeRefund(7, tiers)).toBe(10_000)
    expect(computeRefund(8, tiers)).toBe(10_000)
  })

  test('scenario 6: 100% at 7 days, 50% at 4 days → below 4 is non-refundable', () => {
    const tiers: RefundTier[] = [
      { id: 't1', refund_percentage: 100, days_before_reservation: 7 },
      { id: 't2', refund_percentage: 50, days_before_reservation: 4 },
    ]

    // 1–3 days before: non-refundable
    expect(computeRefund(1, tiers)).toBe(0)
    expect(computeRefund(3, tiers)).toBe(0)

    // 4–6 days before: 50% refund
    expect(computeRefund(4, tiers)).toBe(5_000)
    expect(computeRefund(6, tiers)).toBe(5_000)

    // 7+ days before: 100% refund
    expect(computeRefund(7, tiers)).toBe(10_000)
    expect(computeRefund(9, tiers)).toBe(10_000)
  })
})


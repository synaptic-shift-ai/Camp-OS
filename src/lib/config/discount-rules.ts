/**
 * Discount Amount Rules
 *
 * Single home for how much a configured discount takes off. Sibling to
 * `fee-rules.ts` and `tax-rules.ts`.
 *
 * `percentage_of_total` previously computed against the stay subtotal in three
 * separate engines, making it indistinguishable from `percentage_of_subtotal`
 * even though the type means "percentage of total including fees". Fixing that
 * in one place is why this module exists.
 *
 * @module lib/config/discount-rules
 */

import type { UserDefinedDiscount } from './types'

/** The bases a discount may be charged against, in integer cents. */
export type DiscountAmountContext = {
  /** Stay subtotal, the base for `percentage_of_subtotal`. */
  subtotalCents: number

  /**
   * Base for `percentage_of_total`. The caller decides what "total" covers —
   * normally the subtotal plus applicable fees — so the policy stays at the
   * call site. Pass the subtotal when there are no fees.
   */
  totalBaseCents: number
}

/**
 * How much a discount takes off, in cents, after its cap.
 *
 * Eligibility is a separate question, decided by each engine's trigger rules. A
 * missing configured value yields zero rather than NaN, and a zero
 * `max_discount_cents` means no cap rather than no discount.
 */
export function computeDiscountAmount(
  discount: Pick<
    UserDefinedDiscount,
    'discount_type' | 'value_cents' | 'value_percentage' | 'max_discount_cents'
  >,
  context: DiscountAmountContext,
): number {
  const percentage = (discount.value_percentage ?? 0) / 100

  let amount: number
  switch (discount.discount_type) {
    case 'flat_amount':
      amount = discount.value_cents ?? 0
      break
    case 'percentage_of_subtotal':
      amount = Math.round(context.subtotalCents * percentage)
      break
    case 'percentage_of_total':
      amount = Math.round(context.totalBaseCents * percentage)
      break
    default:
      amount = 0
  }

  const cap = discount.max_discount_cents ?? 0
  return cap > 0 ? Math.min(amount, cap) : amount
}

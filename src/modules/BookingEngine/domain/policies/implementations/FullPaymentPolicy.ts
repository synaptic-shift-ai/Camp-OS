/**
 * Full Payment Confirmation Policy
 *
 * Requires 100% of the reservation total to be paid
 * before confirmation. This is the most restrictive policy.
 *
 * Use case: Online bookings where full payment is collected upfront
 */

import type {
  IConfirmationPolicy,
  ConfirmationContext,
  PolicyResult,
} from '../IConfirmationPolicy'

export class FullPaymentPolicy implements IConfirmationPolicy {
  readonly policyType = 'full_payment'

  canConfirm(context: ConfirmationContext): PolicyResult {
    const { reservation } = context

    // Admin override bypasses payment check
    if (context.isAdminOverride) {
      return { allowed: true }
    }

    if (reservation.paidAmount.isZero()) {
      return {
        allowed: false,
        reason: 'No payment has been received',
        code: 'NO_PAYMENT_RECEIVED',
        minimumRequired: reservation.totalAmount,
      }
    }

    if (!reservation.isFullyPaid()) {
      const remaining = reservation.remainingBalance
      return {
        allowed: false,
        reason: `Payment of ${remaining.formatAsDollars()} is still required. Full payment must be received before confirmation.`,
        code: 'INSUFFICIENT_PAYMENT',
        minimumRequired: reservation.totalAmount,
      }
    }

    return { allowed: true }
  }

  describe(): string {
    return 'Requires full payment (100%) before reservation can be confirmed'
  }
}

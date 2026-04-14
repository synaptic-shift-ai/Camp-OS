/**
 * No Payment Confirmation Policy
 *
 * Allows confirmation without any payment received.
 * Full payment is expected at check-in.
 *
 * Use cases:
 * - Phone reservations where payment is taken at arrival
 * - Walk-in bookings
 * - Admin-created reservations
 * - Trusted/corporate accounts
 */

import type {
  IConfirmationPolicy,
  ConfirmationContext,
  PolicyResult,
} from '../IConfirmationPolicy'

export class NoPaymentPolicy implements IConfirmationPolicy {
  readonly policyType = 'no_payment'

   
  canConfirm(_context: ConfirmationContext): PolicyResult {
    // No payment requirements - always allow
    return { allowed: true }
  }

  describe(): string {
    return 'No payment required for confirmation. Full payment due at check-in.'
  }
}

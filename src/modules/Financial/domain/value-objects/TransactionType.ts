/**
 * TransactionType Enum
 *
 * Defines all types of financial transactions in the system.
 * Used to categorize money movements for reporting and reconciliation.
 */

export enum TransactionType {
  /**
   * Guest payment received for reservation
   */
  PAYMENT = 'payment',

  /**
   * Refund issued to guest (cancellation, overpayment)
   */
  REFUND = 'refund',

  /**
   * Security deposit held (typically via Stripe authorization)
   */
  DEPOSIT = 'deposit',

  /**
   * Security deposit released back to guest
   */
  DEPOSIT_RELEASE = 'deposit_release',

  /**
   * Deduction from security deposit (damages, cleaning)
   */
  DEPOSIT_DEDUCTION = 'deposit_deduction',

  /**
   * Property expense (utilities, maintenance, supplies)
   */
  EXPENSE = 'expense',

  /**
   * Camp-OS platform transaction fee
   */
  PLATFORM_FEE = 'platform_fee',

  /**
   * Payout to property owner
   */
  PAYOUT = 'payout',

  /**
   * Direct charge to guest (e.g., damage fee, late fee, additional service)
   */
  CHARGE = 'charge',
}

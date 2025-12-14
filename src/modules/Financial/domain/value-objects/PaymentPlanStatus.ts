/**
 * PaymentPlanStatus Enum
 *
 * Lifecycle status of a payment plan.
 */

export enum PaymentPlanStatus {
  /**
   * Payment plan is active and on schedule
   */
  ACTIVE = 'active',

  /**
   * All installments have been paid
   */
  COMPLETED = 'completed',

  /**
   * Payment plan was cancelled (reservation cancelled)
   */
  CANCELLED = 'cancelled',

  /**
   * Payment is overdue beyond grace period
   */
  DEFAULTED = 'defaulted',
}

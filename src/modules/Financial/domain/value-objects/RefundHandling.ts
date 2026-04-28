/**
 * RefundHandling Enum
 *
 * Defines how a refund is delivered to the guest.
 * Only applicable to refund-type transactions.
 */

export enum RefundHandling {
  /**
   * Refund to the original payment method (e.g., card, bank transfer)
   */
  ORIGINAL_METHOD = 'original_method',

  /**
   * Refund applied as guest credit balance for future use
   */
  GUEST_CREDIT = 'guest_credit',
}

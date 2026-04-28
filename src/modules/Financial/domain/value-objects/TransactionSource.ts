/**
 * TransactionSource Enum
 *
 * Defines the origin of a financial transaction.
 * Used to track how a transaction was initiated for reporting and auditing.
 */

export enum TransactionSource {
  /**
   * Transaction originated from a reservation booking
   */
  RESERVATION = 'reservation',

  /**
   * Transaction created manually by staff or admin
   */
  MANUAL = 'manual',

  /**
   * Transaction from a point-of-sale terminal
   */
  POS = 'pos',

  /**
   * Transaction initiated automatically by the system (e.g., platform fees)
   */
  SYSTEM = 'system',

  /**
   * Transaction using guest credit balance (e.g., refund-to-credit)
   */
  GUEST_CREDIT = 'guest_credit',
}

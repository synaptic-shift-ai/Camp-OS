/**
 * TransactionStatus Enum
 *
 * Lifecycle status of a financial transaction.
 */

export enum TransactionStatus {
  /**
   * Transaction initiated but not yet processed
   */
  PENDING = 'pending',

  /**
   * Transaction successfully completed
   */
  COMPLETED = 'completed',

  /**
   * Transaction failed (payment declined, insufficient funds, etc.)
   */
  FAILED = 'failed',

  /**
   * Transaction cancelled before completion
   */
  CANCELLED = 'cancelled',
}

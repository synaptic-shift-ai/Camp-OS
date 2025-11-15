/**
 * DepositStatus Enum
 *
 * Status of a security deposit.
 */

export enum DepositStatus {
  /**
   * Deposit is held (authorized or captured)
   */
  HELD = 'held',

  /**
   * Partial amount released, some deductions taken
   */
  PARTIALLY_RELEASED = 'partially_released',

  /**
   * Fully released back to guest
   */
  FULLY_RELEASED = 'fully_released',

  /**
   * Deposit forfeited (not returned to guest)
   */
  FORFEITED = 'forfeited',
}

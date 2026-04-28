/**
 * RecognitionStatus Enum
 *
 * Tracks revenue recognition state for financial transactions.
 * Used primarily for charges and fees to manage when revenue is recognized
 * for accounting purposes.
 */

export enum RecognitionStatus {
  /**
   * Awaiting recognition criteria to be met
   */
  PENDING = 'pending',

  /**
   * Revenue has been recognized
   */
  RECOGNIZED = 'recognized',

  /**
   * Recognition postponed to a future period
   */
  DEFERRED = 'deferred',

  /**
   * Amount written off (uncollectible or waived)
   */
  WRITTEN_OFF = 'written_off',
}

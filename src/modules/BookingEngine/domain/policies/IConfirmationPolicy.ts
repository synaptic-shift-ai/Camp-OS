/**
 * Confirmation Policy Interface
 *
 * Defines the contract for reservation confirmation rules.
 * Implementations determine what conditions must be met before
 * a reservation can transition from 'pending' to 'confirmed'.
 *
 * This is an extension point - new policies can be added without
 * modifying the domain model or existing implementations.
 *
 * Examples:
 * - FullPaymentPolicy: Requires 100% payment
 * - MinimumDepositPolicy: Requires configurable % (e.g., 25%)
 * - NoPaymentPolicy: Admin/walk-in confirmations
 * - Future: Custom policies based on guest type, loyalty status, etc.
 */

import type { Reservation } from '../Reservation'
import type { MoneyAmount } from '../value-objects/MoneyAmount'

/**
 * Result of a policy evaluation
 */
export type PolicyResult =
  | { allowed: true }
  | {
      allowed: false
      reason: string
      code: ConfirmationDenialCode
      minimumRequired?: MoneyAmount
    }

/**
 * Standard denial codes for confirmation policies
 */
export type ConfirmationDenialCode =
  | 'INSUFFICIENT_PAYMENT'
  | 'NO_PAYMENT_RECEIVED'
  | 'BELOW_MINIMUM_DEPOSIT'
  | 'POLICY_VIOLATION'
  | 'CUSTOM'

/**
 * Context provided to policies for evaluation
 */
export interface ConfirmationContext {
  reservation: Reservation
  requestedBy?: string | undefined // User ID requesting confirmation
  isAdminOverride?: boolean | undefined // Whether this is an admin bypass
}

/**
 * Confirmation policy interface
 *
 * Implementations should be stateless and deterministic.
 * All configuration should come from the context or be
 * injected at construction time.
 */
export interface IConfirmationPolicy {
  /**
   * Unique identifier for this policy type
   */
  readonly policyType: string

  /**
   * Evaluate whether a reservation can be confirmed
   *
   * @param context - The reservation and surrounding context
   * @returns PolicyResult indicating whether confirmation is allowed
   */
  canConfirm(context: ConfirmationContext): PolicyResult

  /**
   * Human-readable description of this policy's requirements
   * Useful for displaying to users or in admin interfaces
   */
  describe(): string
}

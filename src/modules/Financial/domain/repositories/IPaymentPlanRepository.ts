/**
 * IPaymentPlanRepository Interface
 *
 * Defines the contract for persisting and retrieving PaymentPlan aggregates.
 */

import type { PaymentPlan } from '../aggregates/PaymentPlan'

export interface IPaymentPlanRepository {
  /**
   * Find payment plan by ID
   */
  findById(id: string): Promise<PaymentPlan | null>

  /**
   * Find payment plan for a reservation (should be unique)
   */
  findByReservation(reservationId: string): Promise<PaymentPlan | null>

  /**
   * Find all active payment plans for a property
   */
  findActiveByProperty(propertyId: string): Promise<PaymentPlan[]>

  /**
   * Save payment plan (insert or update)
   */
  save(plan: PaymentPlan): Promise<void>
}

/**
 * ISecurityDepositRepository Interface
 *
 * Defines the contract for persisting and retrieving SecurityDeposit aggregates.
 */

import type { SecurityDeposit } from './SecurityDeposit'

export interface ISecurityDepositRepository {
  /**
   * Find security deposit by ID
   */
  findById(id: string): Promise<SecurityDeposit | null>

  /**
   * Find security deposit for a reservation (should be unique)
   */
  findByReservation(reservationId: string): Promise<SecurityDeposit | null>

  /**
   * Find all held deposits for a property
   */
  findHeldByProperty(propertyId: string): Promise<SecurityDeposit[]>

  /**
   * Save security deposit (insert or update)
   */
  save(deposit: SecurityDeposit): Promise<void>
}

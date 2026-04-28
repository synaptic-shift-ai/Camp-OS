/**
 * ITransactionRepository Interface
 *
 * Defines the contract for persisting and retrieving Transaction aggregates.
 * Implementation will be in infrastructure layer.
 */

import type { Transaction } from './Transaction'
import type { TransactionType } from './value-objects/TransactionType'
import type { TransactionStatus } from './value-objects/TransactionStatus'

export interface TransactionFilters {
  type?: TransactionType
  status?: TransactionStatus
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export interface ITransactionRepository {
  /**
   * Find transaction by ID
   */
  findById(id: string): Promise<Transaction | null>

  /**
   * Find all transactions for a reservation
   */
  findByReservation(reservationId: string): Promise<Transaction[]>

  /**
   * Find all transactions for a property (with optional filters)
   */
  findByProperty(
    propertyId: string,
    filters?: TransactionFilters
  ): Promise<Transaction[]>

  /**
   * Find all transactions for an invoice
   */
  findByInvoice(invoiceId: string): Promise<Transaction[]>

  /**
   * Save transaction (insert or update)
   */
  save(transaction: Transaction): Promise<void>

  /**
   * Get next transaction number (for sequential numbering if needed)
   */
  nextTransactionNumber(): Promise<number>

  /**
   * Find transaction by processor event ID and type (Stripe webhook idempotency)
   */
  findByProcessorEventId(eventId: string, type: TransactionType): Promise<Transaction | null>

  /**
   * Find all transactions for a guest within a property
   */
  findByGuestId(guestId: string, propertyId: string): Promise<Transaction[]>
}

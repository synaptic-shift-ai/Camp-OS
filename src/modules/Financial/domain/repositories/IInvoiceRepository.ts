/**
 * IInvoiceRepository Interface
 *
 * Defines the contract for persisting and retrieving Invoice aggregates.
 */

import type { Invoice } from '../aggregates/Invoice'
import type { InvoiceNumber } from '../value-objects/InvoiceNumber'
import type { InvoiceStatus } from '../value-objects/InvoiceStatus'

export interface IInvoiceRepository {
  /**
   * Find invoice by ID
   */
  findById(id: string): Promise<Invoice | null>

  /**
   * Find invoice by invoice number
   */
  findByInvoiceNumber(invoiceNumber: InvoiceNumber): Promise<Invoice | null>

  /**
   * Find all invoices for a reservation
   */
  findByReservation(reservationId: string): Promise<Invoice[]>

  /**
   * Find overdue invoices for a property
   */
  findOverdueInvoices(propertyId: string): Promise<Invoice[]>

  /**
   * Find invoices by status
   */
  findByStatus(propertyId: string, status: InvoiceStatus): Promise<Invoice[]>

  /**
   * Save invoice (insert or update)
   */
  save(invoice: Invoice): Promise<void>

  /**
   * Get next invoice sequence number for a property/year
   */
  nextInvoiceSequence(propertyId: string, year: string): Promise<number>
}

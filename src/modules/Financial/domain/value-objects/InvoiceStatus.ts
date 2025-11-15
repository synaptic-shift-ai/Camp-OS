/**
 * InvoiceStatus Enum
 *
 * Lifecycle status of an invoice.
 */

export enum InvoiceStatus {
  /**
   * Invoice created but not yet issued to guest
   */
  DRAFT = 'draft',

  /**
   * Invoice issued and sent to guest
   */
  ISSUED = 'issued',

  /**
   * Invoice fully paid
   */
  PAID = 'paid',

  /**
   * Invoice past due date and not paid
   */
  OVERDUE = 'overdue',

  /**
   * Invoice cancelled (reservation cancelled, etc.)
   */
  CANCELLED = 'cancelled',
}

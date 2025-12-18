/**
 * TransactionDTO
 *
 * Data Transfer Object for Transaction aggregate.
 * Used for API responses.
 */

import type { Transaction } from '../../domain/Transaction'

export interface TransactionDTO {
  id: string
  propertyId: string
  reservationId: string | null
  invoiceId: string | null
  type: string
  amountCents: number
  currency: string
  paymentMethod: string
  stripePaymentIntentId: string | null
  stripeRefundId: string | null
  status: string
  processedAt: string | null
  failureReason: string | null
  notes: string | null
  reconciledAt: string | null
  reconciledBy: string | null
  createdAt: string
  createdBy: string
  updatedAt: string
}

export function toTransactionDTO(transaction: Transaction): TransactionDTO {
  return {
    id: transaction.id,
    propertyId: transaction.propertyId,
    reservationId: transaction.reservationId,
    invoiceId: transaction.invoiceId,
    type: transaction.type,
    amountCents: transaction.amount.amountInCents,
    currency: transaction.currency,
    paymentMethod: transaction.paymentMethod,
    stripePaymentIntentId: transaction.stripePaymentIntentId,
    stripeRefundId: transaction.stripeRefundId,
    status: transaction.status,
    processedAt: transaction.processedAt?.toISOString() || null,
    failureReason: transaction.failureReason,
    notes: transaction.notes,
    reconciledAt: transaction.reconciledAt?.toISOString() || null,
    reconciledBy: transaction.reconciledBy,
    createdAt: transaction.createdAt.toISOString(),
    createdBy: transaction.createdBy,
    updatedAt: transaction.updatedAt.toISOString(),
  }
}

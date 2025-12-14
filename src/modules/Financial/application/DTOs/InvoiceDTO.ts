/**
 * InvoiceDTO
 *
 * Data Transfer Object for Invoice aggregate.
 * Used for API responses.
 */

import type { Invoice } from '../../domain/aggregates/Invoice'

export interface InvoiceLineItemDTO {
  description: string
  quantity: number
  unitPriceCents: number
  totalCents: number
}

export interface InvoiceDTO {
  id: string
  propertyId: string
  reservationId: string
  invoiceNumber: string
  lineItems: InvoiceLineItemDTO[]
  subtotalCents: number
  taxCents: number
  totalCents: number
  paidCents: number
  balanceCents: number
  taxRate: number
  isInstallment: boolean
  installmentNumber: number | null
  installmentTotal: number | null
  dueDate: string
  status: string
  issuedAt: string | null
  paidAt: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}

export function toInvoiceDTO(invoice: Invoice): InvoiceDTO {
  return {
    id: invoice.id,
    propertyId: invoice.propertyId,
    reservationId: invoice.reservationId,
    invoiceNumber: invoice.invoiceNumber.value,
    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPrice.amountInCents,
      totalCents: item.total.amountInCents,
    })),
    subtotalCents: invoice.subtotal.amountInCents,
    taxCents: invoice.tax.amountInCents,
    totalCents: invoice.total.amountInCents,
    paidCents: invoice.paidAmount.amountInCents,
    balanceCents: invoice.balance.amountInCents,
    taxRate: invoice.taxRate,
    isInstallment: invoice.isInstallment,
    installmentNumber: invoice.installmentNumber,
    installmentTotal: invoice.installmentTotal,
    dueDate: invoice.dueDate.toISOString(),
    status: invoice.status,
    issuedAt: invoice.issuedAt?.toISOString() || null,
    paidAt: invoice.paidAt?.toISOString() || null,
    cancelledAt: invoice.cancelledAt?.toISOString() || null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  }
}

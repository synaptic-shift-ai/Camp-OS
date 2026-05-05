/**
 * GenerateInvoiceCommand
 *
 * Generates an invoice for a reservation.
 * Used for both one-time invoices and installment invoices.
 */

import type { IInvoiceRepository } from '../../domain/IInvoiceRepository'
import { Invoice } from '../../domain/Invoice'
import { InvoiceNumber } from '../../domain//value-objects/InvoiceNumber'
import { InvoiceLineItem } from '../../domain//value-objects/InvoiceLineItem'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'

export interface InvoiceLineItemDto {
  description: string
  quantity: number
  unitPriceCents: number
}

export interface GenerateInvoiceDto {
  invoiceId: string
  propertyId: string
  propertyCode: string // For invoice number (e.g., "YY")
  reservationId: string
  lineItems: InvoiceLineItemDto[]
  taxRate: number
  dueDate: Date
  isInstallment?: boolean
  installmentNumber?: number
  installmentTotal?: number
}

export class GenerateInvoiceCommandHandler {
  constructor(private readonly invoiceRepository: IInvoiceRepository) {}

  async execute(dto: GenerateInvoiceDto): Promise<Invoice> {
    // Get current year (2-digit)
    const year = new Date().getFullYear().toString().substring(2)

    // Get next invoice sequence for this property/year
    const sequence = await this.invoiceRepository.nextInvoiceSequence(
      dto.propertyId,
      year
    )

    // Create invoice number
    const invoiceNumber = InvoiceNumber.create(dto.propertyCode, year, sequence)

    // Create line items
    const lineItems = dto.lineItems.map((item) =>
      InvoiceLineItem.create(
        item.description,
        item.quantity,
        MoneyAmount.create(item.unitPriceCents)
      )
    )

    // Create invoice
    let invoice: Invoice

    if (dto.isInstallment && dto.installmentNumber && dto.installmentTotal) {
      invoice = Invoice.createInstallment(
        dto.invoiceId,
        dto.propertyId,
        dto.reservationId,
        invoiceNumber,
        lineItems,
        dto.taxRate,
        dto.dueDate,
        dto.installmentNumber,
        dto.installmentTotal
      )
    } else {
      invoice = Invoice.create(
        dto.invoiceId,
        dto.propertyId,
        dto.reservationId,
        invoiceNumber,
        lineItems,
        dto.taxRate,
        dto.dueDate
      )
    }

    // Save invoice
    await this.invoiceRepository.save(invoice)

    // Clear domain events
    invoice.clearDomainEvents()

    return invoice
  }
}

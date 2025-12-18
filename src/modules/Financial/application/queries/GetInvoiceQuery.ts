/**
 * GetInvoiceQuery
 *
 * Retrieves a single invoice by ID.
 */

import type { IInvoiceRepository } from '../../domain/IInvoiceRepository'
import type { Invoice } from '../../domain/Invoice'

export class GetInvoiceQueryHandler {
  constructor(private readonly invoiceRepository: IInvoiceRepository) {}

  async execute(invoiceId: string): Promise<Invoice | null> {
    return await this.invoiceRepository.findById(invoiceId)
  }
}

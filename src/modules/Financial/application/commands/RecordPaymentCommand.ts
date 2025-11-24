/**
 * RecordPaymentCommand
 *
 * Records a payment transaction for a reservation.
 * This is the main entry point for processing guest payments.
 */

import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { IInvoiceRepository } from '../../domain/repositories/IInvoiceRepository'
import { Transaction } from '../../domain/aggregates/Transaction'
import { TransactionType } from '../../domain/value-objects/TransactionType'
import { PaymentMethod } from '../../domain/value-objects/PaymentMethod'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export interface RecordPaymentDto {
  transactionId: string
  propertyId: string
  reservationId: string
  invoiceId?: string | null | undefined
  amountCents: number
  paymentMethod: PaymentMethod
  stripePaymentIntentId?: string | null | undefined
  notes?: string | null | undefined
  createdBy: string
}

export class RecordPaymentCommandHandler {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly invoiceRepository: IInvoiceRepository
  ) {}

  async execute(dto: RecordPaymentDto): Promise<Transaction> {
    // Create money amount
    const amount = MoneyAmount.create(dto.amountCents)

    // Create transaction
    const transaction = Transaction.create(
      dto.transactionId,
      dto.propertyId,
      dto.reservationId,
      TransactionType.PAYMENT,
      amount,
      dto.paymentMethod,
      dto.createdBy,
      dto.invoiceId || null,
      dto.notes || null
    )

    // Complete transaction (assume payment already processed via Stripe)
    transaction.complete(dto.stripePaymentIntentId || null)

    // Save transaction
    await this.transactionRepository.save(transaction)

    // If invoice ID provided, apply payment to invoice
    if (dto.invoiceId) {
      const invoice = await this.invoiceRepository.findById(dto.invoiceId)
      if (invoice) {
        invoice.applyPayment(transaction.id, amount)
        await this.invoiceRepository.save(invoice)
      }
    }

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll([...transaction.getDomainEvents()])
    transaction.clearDomainEvents()

    return transaction
  }
}

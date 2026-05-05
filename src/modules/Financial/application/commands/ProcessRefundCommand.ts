/**
 * ProcessRefundCommand
 *
 * Processes a refund for a cancelled reservation or overpayment.
 */

import type { ITransactionRepository } from '../../domain/ITransactionRepository'
import { Transaction } from '../../domain/Transaction'
import { type PaymentMethod } from '../../domain//value-objects/PaymentMethod'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'

export interface ProcessRefundDto {
  transactionId: string
  propertyId: string
  reservationId: string
  amountCents: number
  paymentMethod: PaymentMethod
  originalTransactionId?: string | null
  stripeRefundId?: string | null
  reason?: string | null
  createdBy: string
}

export class ProcessRefundCommandHandler {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute(dto: ProcessRefundDto): Promise<Transaction> {
    // Create refund amount
    const amount = MoneyAmount.create(dto.amountCents)

    // Create refund transaction
    const refund = Transaction.createRefund(
      dto.transactionId,
      dto.propertyId,
      dto.reservationId,
      amount,
      dto.paymentMethod,
      dto.createdBy,
      dto.originalTransactionId || null,
      dto.reason || null
    )

    // Complete refund (assume already processed via Stripe)
    refund.complete(dto.stripeRefundId || null)

    // Save refund transaction
    await this.transactionRepository.save(refund)

    // Clear domain events
    refund.clearDomainEvents()

    return refund
  }
}

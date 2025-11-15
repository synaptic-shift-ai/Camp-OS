/**
 * GetReservationBalanceQuery
 *
 * Retrieves the financial balance for a reservation.
 * Returns total amount, paid amount, and balance due.
 */

import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { IInvoiceRepository } from '../../domain/repositories/IInvoiceRepository'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { TransactionType } from '../../domain/value-objects/TransactionType'
import { TransactionStatus } from '../../domain/value-objects/TransactionStatus'

export interface ReservationBalanceResult {
  reservationId: string
  totalCents: number
  paidCents: number
  balanceCents: number
  invoices: {
    id: string
    invoiceNumber: string
    totalCents: number
    paidCents: number
    balanceCents: number
    status: string
  }[]
}

export class GetReservationBalanceQueryHandler {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly invoiceRepository: IInvoiceRepository
  ) {}

  async execute(reservationId: string): Promise<ReservationBalanceResult> {
    // Get all invoices for reservation
    const invoices = await this.invoiceRepository.findByReservation(reservationId)

    // Get all completed payment transactions
    const transactions = await this.transactionRepository.findByReservation(
      reservationId
    )

    const payments = transactions.filter(
      (t) =>
        t.type === TransactionType.PAYMENT &&
        t.status === TransactionStatus.COMPLETED
    )

    // Calculate total paid
    const totalPaid = payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      MoneyAmount.zero()
    )

    // Calculate total owed (sum of all invoice totals)
    const totalOwed = invoices.reduce(
      (sum, invoice) => sum.add(invoice.total),
      MoneyAmount.zero()
    )

    // Calculate balance
    const balance = totalOwed.subtract(totalPaid)

    return {
      reservationId,
      totalCents: totalOwed.amountInCents,
      paidCents: totalPaid.amountInCents,
      balanceCents: balance.amountInCents,
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber.value,
        totalCents: invoice.total.amountInCents,
        paidCents: invoice.paidAmount.amountInCents,
        balanceCents: invoice.balance.amountInCents,
        status: invoice.status,
      })),
    }
  }
}

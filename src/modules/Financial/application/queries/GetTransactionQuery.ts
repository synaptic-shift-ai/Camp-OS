/**
 * GetTransactionQuery
 *
 * Retrieves a single transaction by ID.
 */

import type { ITransactionRepository } from '../../domain/ITransactionRepository'
import type { Transaction } from '../../domain/Transaction'

export class GetTransactionQueryHandler {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute(transactionId: string): Promise<Transaction | null> {
    return await this.transactionRepository.findById(transactionId)
  }
}

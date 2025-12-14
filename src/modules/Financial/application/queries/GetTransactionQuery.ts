/**
 * GetTransactionQuery
 *
 * Retrieves a single transaction by ID.
 */

import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { Transaction } from '../../domain/aggregates/Transaction'

export class GetTransactionQueryHandler {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute(transactionId: string): Promise<Transaction | null> {
    return await this.transactionRepository.findById(transactionId)
  }
}

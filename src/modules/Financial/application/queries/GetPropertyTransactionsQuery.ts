/**
 * GetPropertyTransactionsQuery
 *
 * Retrieves all transactions for a property with optional filtering.
 */

import type {
  ITransactionRepository,
  TransactionFilters,
} from '../../domain/ITransactionRepository'
import type { Transaction } from '../../domain/Transaction'

export interface GetPropertyTransactionsDto {
  propertyId: string
  filters?: TransactionFilters
}

export class GetPropertyTransactionsQueryHandler {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute(dto: GetPropertyTransactionsDto): Promise<Transaction[]> {
    return await this.transactionRepository.findByProperty(
      dto.propertyId,
      dto.filters
    )
  }
}

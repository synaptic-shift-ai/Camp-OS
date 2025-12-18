// @ts-nocheck - Financial tables not yet in database schema
/**
 * SupabaseTransactionRepository
 *
 * Supabase implementation of ITransactionRepository.
 * Handles persistence of Transaction aggregates.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ITransactionRepository,
  TransactionFilters,
} from '../domain/ITransactionRepository'
import { Transaction } from '../domain/Transaction'
import type { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'
import type { Database } from '@/contracts/db'

type TransactionInsert = Database['public']['Tables']['financial_transactions']['Insert']

export class SupabaseTransactionRepository implements ITransactionRepository {
  private readonly supabase: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database> | SupabaseContext) {
    // Normalize to raw client (D-1: Support both SupabaseClient and SupabaseContext)
    this.supabase = 'getRawClient' in client ? client.getRawClient() : client
  }

  async findById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return Transaction.fromPersistence(data)
  }

  async findByReservation(reservationId: string): Promise<Transaction[]> {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row) => Transaction.fromPersistence(row))
  }

  async findByProperty(
    propertyId: string,
    filters?: TransactionFilters
  ): Promise<Transaction[]> {
    let query = this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('property_id', propertyId)

    // Apply filters
    if (filters?.type) {
      query = query.eq('type', filters.type)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString())
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString())
    }

    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error || !data) {
      return []
    }

    return data.map((row) => Transaction.fromPersistence(row))
  }

  async findByInvoice(invoiceId: string): Promise<Transaction[]> {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row) => Transaction.fromPersistence(row))
  }

  async save(transaction: Transaction): Promise<void> {
    const persistence = transaction.toPersistence()

    const { error } = await this.supabase
      .from('financial_transactions')
      .upsert(persistence as TransactionInsert, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to save transaction: ${error.message}`)
    }
  }

  async nextTransactionNumber(): Promise<number> {
    // Get the count of all transactions
    const { count, error } = await this.supabase
      .from('financial_transactions')
      .select('*', { count: 'exact', head: true })

    if (error) {
      throw new Error(`Failed to get transaction count: ${error.message}`)
    }

    return (count || 0) + 1
  }
}

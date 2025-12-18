// @ts-nocheck - Financial tables not yet in database schema
/**
 * SupabaseSecurityDepositRepository
 *
 * Supabase implementation of ISecurityDepositRepository.
 * Handles persistence of SecurityDeposit aggregates.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ISecurityDepositRepository } from '../domain/ISecurityDepositRepository'
import { SecurityDeposit } from '../domain/SecurityDeposit'
import { DepositStatus } from '../domain//value-objects/DepositStatus'
import type { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'
import type { Database } from '@/contracts/db'

type SecurityDepositInsert = Database['public']['Tables']['financial_security_deposits']['Insert']

export class SupabaseSecurityDepositRepository implements ISecurityDepositRepository {
  private readonly supabase: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database> | SupabaseContext) {
    // Normalize to raw client (D-1: Support both SupabaseClient and SupabaseContext)
    this.supabase = 'getRawClient' in client ? client.getRawClient() : client
  }

  async findById(id: string): Promise<SecurityDeposit | null> {
    const { data, error } = await this.supabase
      .from('financial_security_deposits')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return SecurityDeposit.fromPersistence(data)
  }

  async findByReservation(reservationId: string): Promise<SecurityDeposit | null> {
    const { data, error } = await this.supabase
      .from('financial_security_deposits')
      .select('*')
      .eq('reservation_id', reservationId)
      .single()

    if (error || !data) {
      return null
    }

    return SecurityDeposit.fromPersistence(data)
  }

  async findHeldByProperty(propertyId: string): Promise<SecurityDeposit[]> {
    const { data, error } = await this.supabase
      .from('financial_security_deposits')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', DepositStatus.HELD)
      .order('held_at', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row) => SecurityDeposit.fromPersistence(row))
  }

  async save(deposit: SecurityDeposit): Promise<void> {
    const persistence = deposit.toPersistence()

    const { error } = await this.supabase
      .from('financial_security_deposits')
      .upsert(persistence as SecurityDepositInsert, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to save security deposit: ${error.message}`)
    }
  }
}

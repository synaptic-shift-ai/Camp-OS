/**
 * SupabaseSecurityDepositRepository
 *
 * Supabase implementation of ISecurityDepositRepository.
 * Handles persistence of SecurityDeposit aggregates.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ISecurityDepositRepository } from '../domain/repositories/ISecurityDepositRepository'
import { SecurityDeposit } from '../domain/aggregates/SecurityDeposit'
import { DepositStatus } from '../domain/value-objects/DepositStatus'

export class SupabaseSecurityDepositRepository implements ISecurityDepositRepository {
  constructor(private readonly supabase: SupabaseClient) {}

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
      .upsert(persistence, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to save security deposit: ${error.message}`)
    }
  }
}

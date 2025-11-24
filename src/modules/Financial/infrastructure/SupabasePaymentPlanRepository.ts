/**
 * SupabasePaymentPlanRepository
 *
 * Supabase implementation of IPaymentPlanRepository.
 * Handles persistence of PaymentPlan aggregates.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { IPaymentPlanRepository } from '../domain/repositories/IPaymentPlanRepository'
import { PaymentPlan } from '../domain/aggregates/PaymentPlan'
import { PaymentPlanStatus } from '../domain/value-objects/PaymentPlanStatus'
import type { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'
import type { Database } from '@/contracts/db'

export class SupabasePaymentPlanRepository implements IPaymentPlanRepository {
  private readonly supabase: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database> | SupabaseContext) {
    // Normalize to raw client (D-1: Support both SupabaseClient and SupabaseContext)
    this.supabase = 'getRawClient' in client ? client.getRawClient() : client
  }

  async findById(id: string): Promise<PaymentPlan | null> {
    const { data, error } = await this.supabase
      .from('financial_payment_plans')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return PaymentPlan.fromPersistence(data)
  }

  async findByReservation(reservationId: string): Promise<PaymentPlan | null> {
    const { data, error } = await this.supabase
      .from('financial_payment_plans')
      .select('*')
      .eq('reservation_id', reservationId)
      .single()

    if (error || !data) {
      return null
    }

    return PaymentPlan.fromPersistence(data)
  }

  async findActiveByProperty(propertyId: string): Promise<PaymentPlan[]> {
    const { data, error } = await this.supabase
      .from('financial_payment_plans')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', PaymentPlanStatus.ACTIVE)
      .order('created_at', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row) => PaymentPlan.fromPersistence(row))
  }

  async save(plan: PaymentPlan): Promise<void> {
    const persistence = plan.toPersistence()

    const { error } = await this.supabase
      .from('financial_payment_plans')
      .upsert(persistence, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to save payment plan: ${error.message}`)
    }
  }
}

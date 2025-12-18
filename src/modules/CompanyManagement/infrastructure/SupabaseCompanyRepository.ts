/**
 * SupabaseCompanyRepository
 *
 * Concrete implementation of ICompanyRepository using Supabase.
 * Maps between database rows and Company domain entities.
 *
 * Following CLAUDE.md:
 * - D-1: Type helper as SupabaseClient for now (transactions later)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'
import type { ICompanyRepository } from '../domain/ICompanyRepository'
import { Company } from '../domain/Company'
import { CompanyName } from '../domain/value-objects/CompanyName'
import { SubscriptionPlan } from '../domain/value-objects/SubscriptionPlan'
import { SubscriptionStatus } from '../domain/value-objects/SubscriptionStatus'
import { BillingCycle } from '../domain/value-objects/BillingCycle'
import { OnboardingToken } from '../domain/value-objects/OnboardingToken'

type CompanyRow = Database['public']['Tables']['companies']['Row']

export class SupabaseCompanyRepository implements ICompanyRepository {
  private readonly supabase: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database>) {
    this.supabase = client
  }

  async findById(id: string): Promise<Company | null> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async findByOwnerId(ownerId: string): Promise<Company | null> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('owner_id', ownerId)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async findByOnboardingToken(token: string): Promise<Company | null> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('onboarding_token', token)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<Company | null> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async save(company: Company): Promise<void> {
    const row = company.toPersistence()

    // Check if exists
    const { data: existing } = await this.supabase
      .from('companies')
      .select('id')
      .eq('id', company.id)
      .single()

    if (existing) {
      // Update
      const { error } = await this.supabase
        .from('companies')
        .update(row)
        .eq('id', company.id)

      if (error) {
        throw new Error(`Failed to update company: ${error.message}`)
      }
    } else {
      // Insert
      const { error } = await this.supabase.from('companies').insert(row)

      if (error) {
        throw new Error(`Failed to create company: ${error.message}`)
      }
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('companies')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete company: ${error.message}`)
    }
  }

  async isNameTaken(name: string, excludeId?: string): Promise<boolean> {
    let query = this.supabase
      .from('companies')
      .select('id')
      .eq('name', name)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query.single()

    return !error && data !== null
  }

  /**
   * Map database row to domain entity
   */
  private toDomain(row: CompanyRow): Company {
    // Create value objects
    const name = CompanyName.create(row.name)
    const subscriptionPlan = SubscriptionPlan.fromString(row.subscription_plan)
    const subscriptionStatus = SubscriptionStatus.fromString(row.subscription_status)
    const billingCycle = BillingCycle.fromString(row.billing_cycle)

    // Create onboarding token if exists
    let onboardingToken: OnboardingToken | null = null
    if (row.onboarding_token && row.onboarding_token_expires_at) {
      onboardingToken = OnboardingToken.fromPersistence(
        row.onboarding_token,
        new Date(row.onboarding_token_expires_at),
        row.onboarding_token_used_at ? new Date(row.onboarding_token_used_at) : null
      )
    }

    // Reconstitute domain entity
    return Company.fromPersistence(
      row.id,
      row.owner_id,
      name,
      row.stripe_customer_id,
      row.subscription_id,
      subscriptionStatus,
      subscriptionPlan,
      billingCycle,
      row.subscription_created_at ? new Date(row.subscription_created_at) : null,
      row.subscription_canceled_at ? new Date(row.subscription_canceled_at) : null,
      onboardingToken,
      new Date(row.created_at!),
      new Date(row.updated_at!)
    )
  }
}

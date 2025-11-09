/**
 * SupabaseGuestRepository
 *
 * Concrete implementation of IGuestRepository using Supabase.
 * Maps between database rows and Guest domain entities.
 *
 * CRITICAL (Oct 30 Bug Fix):
 * - Always uses .select('*') to fetch complete entities
 * - Prevents selective field fetching that could cause missing fields
 * - All fields are validated when converting to domain entities
 *
 * Following CLAUDE.md:
 * - D-1: Type helper as SupabaseClient for now (transactions later)
 * - D-2: Always include tenant isolation (property_id filter)
 * - BP-4: Enforce tenant context in queries
 */
import type { IGuestRepository } from '../domain/IGuestRepository'
import { Guest } from '../domain/Guest'
import { PersonName } from '../domain/PersonName'
import { ContactInfo } from '../domain/ContactInfo'
import { Address } from '../domain/Address'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'

type GuestRow = {
  id: string
  property_id: string
  user_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  stripe_customer_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export class SupabaseGuestRepository implements IGuestRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async findById(guestId: string): Promise<Guest | null> {
    const { data, error } = await this.supabase
      .from('guests')
      .select('*') // Complete entity - NO selective fetching! (Oct 30 fix)
      .eq('id', guestId)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data as GuestRow)
  }

  async findByEmail(propertyId: string, email: string): Promise<Guest | null> {
    const { data, error } = await this.supabase
      .from('guests')
      .select('*')
      .eq('property_id', propertyId) // BP-4: Tenant isolation
      .eq('email', email)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data as GuestRow)
  }

  async findByPropertyId(propertyId: string): Promise<Guest[]> {
    const { data, error } = await this.supabase
      .from('guests')
      .select('*')
      .eq('property_id', propertyId) // BP-4: Tenant isolation
      .order('created_at', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row) => this.toDomain(row as GuestRow))
  }

  async findByStripeCustomerId(customerId: string): Promise<Guest | null> {
    const { data, error } = await this.supabase
      .from('guests')
      .select('*')
      .eq('stripe_customer_id', customerId)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data as GuestRow)
  }

  async exists(propertyId: string, email: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('guests')
      .select('id')
      .eq('property_id', propertyId) // BP-4: Tenant isolation
      .eq('email', email)
      .single()

    return !error && data !== null
  }

  async save(guest: Guest): Promise<void> {
    const persistence = guest.toPersistence()

    // Check if exists
    const existing = await this.findById(guest.id)

    if (existing) {
      // Update
      const { error } = await this.supabase
        .from('guests')
        .update(persistence)
        .eq('id', guest.id)

      if (error) {
        throw new Error(`Failed to update guest: ${error.message}`)
      }
    } else {
      // Insert
      const { error } = await this.supabase.from('guests').insert(persistence)

      if (error) {
        throw new Error(`Failed to create guest: ${error.message}`)
      }
    }
  }

  /**
   * Map database row to domain entity
   *
   * CRITICAL: This validates all required fields exist
   * Missing fields would throw errors, making bugs visible
   * (Oct 30 fix - all fields must be present)
   */
  private toDomain(row: GuestRow): Guest {
    // Create value objects
    const name = PersonName.create({
      firstName: row.first_name,
      lastName: row.last_name,
    })

    const contact = ContactInfo.create({
      email: row.email,
      phone: row.phone || '',
      emergencyContactName: row.emergency_contact_name || undefined,
      emergencyContactPhone: row.emergency_contact_phone || undefined,
    })

    // Address requires all fields or none
    let address: Address | null = null
    if (
      row.address &&
      row.city &&
      row.state &&
      row.zip_code &&
      row.country
    ) {
      address = Address.create({
        street: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        country: row.country,
      })
    }

    // Reconstitute domain entity
    return Guest.fromPersistence(
      row.id,
      row.property_id,
      row.user_id,
      name,
      contact,
      address,
      row.stripe_customer_id,
      row.notes,
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  }
}

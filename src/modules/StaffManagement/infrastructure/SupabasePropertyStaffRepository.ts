/**
 * SupabasePropertyStaffRepository
 *
 * Concrete implementation of IPropertyStaffRepository using Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'
import type { IPropertyStaffRepository } from '../domain/IPropertyStaffRepository'
import { PropertyStaff } from '../domain/PropertyStaff'
import { StaffRole } from '../domain/value-objects/StaffRole'
import { Permissions } from '../domain/value-objects/Permissions'

type PropertyStaffRow = Database['public']['Tables']['property_staff']['Row']

export class SupabasePropertyStaffRepository implements IPropertyStaffRepository {
  private readonly supabase: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database>) {
    this.supabase = client
  }

  async findById(id: string): Promise<PropertyStaff | null> {
    const { data, error } = await this.supabase
      .from('property_staff')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async findByPropertyAndUser(propertyId: string, userId: string): Promise<PropertyStaff | null> {
    const { data, error } = await this.supabase
      .from('property_staff')
      .select('*')
      .eq('property_id', propertyId)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async findByProperty(propertyId: string): Promise<PropertyStaff[]> {
    const { data, error } = await this.supabase
      .from('property_staff')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row) => this.toDomain(row))
  }

  async findByUser(userId: string): Promise<PropertyStaff[]> {
    const { data, error } = await this.supabase
      .from('property_staff')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row) => this.toDomain(row))
  }

  async save(staff: PropertyStaff): Promise<void> {
    const row = staff.toPersistence()

    const { error } = await this.supabase.from('property_staff').upsert(row)

    if (error) {
      throw new Error(`Failed to save PropertyStaff: ${error.message}`)
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('property_staff').delete().eq('id', id)

    if (error) {
      throw new Error(`Failed to delete PropertyStaff: ${error.message}`)
    }
  }

  async existsByPropertyAndUser(
    propertyId: string,
    userId: string,
    excludeId?: string
  ): Promise<boolean> {
    let query = this.supabase
      .from('property_staff')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('user_id', userId)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { count, error } = await query

    if (error) {
      throw new Error(`Failed to check staff existence: ${error.message}`)
    }

    return (count ?? 0) > 0
  }

  async countByProperty(propertyId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('property_staff')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)

    if (error) {
      throw new Error(`Failed to count property staff: ${error.message}`)
    }

    return count ?? 0
  }

  private toDomain(row: PropertyStaffRow): PropertyStaff {
    const role = StaffRole.fromString(row.role)
    const permissions = Permissions.fromPersistence(row.permissions)

    return PropertyStaff.fromPersistence(
      row.id,
      row.property_id || '',
      row.user_id || '',
      role,
      permissions,
      row.created_at ? new Date(row.created_at) : new Date(),
      row.updated_at ? new Date(row.updated_at) : new Date()
    )
  }
}

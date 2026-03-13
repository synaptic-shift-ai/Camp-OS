/**
 * SupabasePropertyRepository
 *
 * Concrete implementation of IPropertyRepository using Supabase.
 * Maps between database rows and domain entities.
 *
 * CRITICAL (Oct 30 Bug Fix):
 * - Always uses .select('*') to fetch complete entities
 * - Prevents selective field fetching that caused onboarding_completed to be missing
 * - All fields are validated when converting to domain entities
 *
 * Following CLAUDE.md:
 * - D-1: Type helper as SupabaseClient | SupabaseClient['from'] for transactions
 * - D-2: Always include tenant isolation (company_id filter)
 * - BP-4: Enforce tenant context in queries
 */
import type { IPropertyRepository } from '../domain/IPropertyRepository'
import { Property } from '../domain/Property'
import { type PropertyType } from '../domain/PropertyType'
import { PropertyStatus } from '../domain/PropertyStatus'
import { PropertySettings } from '../domain/PropertySettings'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'

type PropertyInsert = Database['public']['Tables']['properties']['Insert']
import type { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'

type PropertyRow = Database['public']['Tables']['properties']['Row']

function parseGalleryImages(value: unknown): string[] | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const urls = value
      .map((item) => (typeof item === 'string' ? item : (item as { url?: string })?.url))
      .filter((u): u is string => typeof u === 'string')
    return urls.length > 0 ? urls : null
  }
  return null
}

export class SupabasePropertyRepository implements IPropertyRepository {
  private readonly supabase: SupabaseClient<Database> | ReturnType<SupabaseClient<Database>['from']>

  constructor(
    client: SupabaseClient<Database> | SupabaseContext | ReturnType<SupabaseClient<Database>['from']>
  ) {
    // Normalize to raw client (D-1: Support SupabaseClient, SupabaseContext, and transaction objects)
    this.supabase = 'getRawClient' in client ? client.getRawClient() : client
  }

  async findById(id: string): Promise<Property | null> {
    const { data, error } = await this.getClient()
      .from('properties')
      .select('*') // Complete entity - NO selective fetching! (Oct 30 fix)
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async findBySlug(slug: string): Promise<Property | null> {
    const { data, error } = await this.getClient()
      .from('properties')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async findByCompanyId(companyId: string): Promise<Property[]> {
    const { data, error } = await this.getClient()
      .from('properties')
      .select('*')
      .eq('company_id', companyId) // BP-4: Tenant isolation
      .order('created_at', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row) => this.toDomain(row))
  }

  async findByCompanyIdWithFilters(
    companyId: string,
    filters: {
      status?: PropertyStatus
      onboardingComplete?: boolean
      limit?: number
      offset?: number
    }
  ): Promise<{ properties: Property[]; total: number }> {
    // Build query
    let query = this.getClient()
      .from('properties')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId) // BP-4: Tenant isolation

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.onboardingComplete !== undefined) {
      query = query.eq('onboarding_completed', filters.onboardingComplete)
    }

    // Apply pagination
    if (filters.limit) {
      const offset = filters.offset || 0
      query = query.range(offset, offset + filters.limit - 1)
    }

    // Order by created date
    query = query.order('created_at', { ascending: true })

    const { data, error, count } = await query

    if (error || !data) {
      return { properties: [], total: 0 }
    }

    return {
      properties: data.map((row) => this.toDomain(row)),
      total: count || 0,
    }
  }

  async findByOwnerId(ownerId: string): Promise<Property | null> {
    const { data, error } = await this.getClient()
      .from('properties')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async save(property: Property, columnOverrides?: Partial<PropertyRow>): Promise<void> {
    const persistence = property.toPersistence()

    // Check if exists
    const existing = await this.findById(property.id)

    if (existing) {
      // Update (merge columnOverrides for dedicated columns e.g. cancellation_policy, cancellation_policy_config)
      const updatePayload = { ...persistence, ...columnOverrides }
      const { error } = await this.getClient()
        .from('properties')
        .update(updatePayload)
        .eq('id', property.id)

      if (error) {
        throw new Error(`Failed to update property: ${error.message}`)
      }
    } else {
      // Insert
      const { error } = await this.getClient()
        .from('properties')
        .insert(persistence as PropertyInsert)

      if (error) {
        throw new Error(`Failed to create property: ${error.message}`)
      }
    }
  }

  async delete(id: string): Promise<void> {
    // Soft delete by setting status to INACTIVE
    // Hard delete would break referential integrity with sites, reservations, etc.
    const { error } = await this.getClient()
      .from('properties')
      .update({ status: PropertyStatus.INACTIVE })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete property: ${error.message}`)
    }
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const { data, error } = await this.getClient()
      .from('properties')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single()

    return !error && data !== null
  }

  async slugExistsForOtherProperty(
    slug: string,
    excludePropertyId: string
  ): Promise<boolean> {
    const { data, error } = await this.getClient()
      .from('properties')
      .select('id')
      .eq('slug', slug)
      .neq('id', excludePropertyId)
      .limit(1)
      .single()

    return !error && data !== null
  }

  /**
   * Convert database row to domain entity
   *
   * CRITICAL: This validates all required fields exist
   * Missing fields would throw errors, making bugs visible
   * (Oct 30 fix - onboarding_completed must be present)
   */
  private toDomain(row: PropertyRow): Property {
    // Validate critical fields (Oct 30 fix)
    if (row.id === null || row.id === undefined) {
      throw new Error('Property row missing id field')
    }
    if (row.company_id === null || row.company_id === undefined) {
      throw new Error('Property row missing company_id field (tenant isolation)')
    }
    if (row.name === null || row.name === undefined) {
      throw new Error('Property row missing name field')
    }
    if (row.slug === null || row.slug === undefined) {
      throw new Error('Property row missing slug field')
    }
    if (row.onboarding_completed === null || row.onboarding_completed === undefined) {
      throw new Error('Property row missing onboarding_completed field (CRITICAL)')
    }

    // Parse property type
    const propertyType = row.property_type
      ? (row.property_type as PropertyType)
      : null

    // Parse property status
    const status = (row.status as PropertyStatus) || PropertyStatus.DRAFT

    // Parse settings from JSONB
    const settings = PropertySettings.fromJson(
      row.settings as Record<string, any> | null
    )

    // Parse amenities
    const amenities = Array.isArray(row.amenities) ? (row.amenities as string[]) : null

    // Parse gallery_images: JSONB may be string[] or [{ url, caption?, order? }]
    const galleryImages = parseGalleryImages(row.gallery_images)

    return Property.fromPersistence(
      row.id,
      row.company_id,
      row.owner_id,
      row.name,
      row.slug,
      row.description,
      propertyType,
      status,
      row.address,
      row.city,
      row.state,
      row.zip_code,
      row.country,
      row.phone,
      row.email,
      row.check_in_time ?? null,
      row.check_out_time ?? null,
      row.subdomain,
      row.booking_page_slug,
      row.hero_image_url,
      galleryImages,
      settings,
      amenities,
      row.check_in_instructions,
      row.check_out_instructions,
      row.house_rules,
      row.onboarding_completed, // CRITICAL: Must be present
      row.onboarding_completed_at ? new Date(row.onboarding_completed_at) : null,
      row.stripe_account_id,
      row.stripe_connected_at ? new Date(row.stripe_connected_at) : null,
      new Date(row.created_at || new Date()),
      new Date(row.updated_at || new Date())
    )
  }

  /**
   * Get the Supabase client (handles both direct client and transaction builder)
   * D-1: Support both SupabaseClient and SupabaseClient['from']
   */
  private getClient(): SupabaseClient<Database> {
    // If it's already a client, return it
    if ('from' in this.supabase) {
      return this.supabase as SupabaseClient<Database>
    }

    // If it's a query builder from a transaction, we can't easily extract the client
    // For now, cast it - in real transactions we'd handle this differently
    return this.supabase as any
  }
}

/**
 * SupabaseSiteRepository
 *
 * Concrete implementation of ISiteRepository using Supabase.
 * Maps between database rows and domain entities.
 *
 * IMPORTANT: Always uses .select('*') to fetch complete entities
 * (prevents Oct 30 incident - selective field fetching causing silent failures)
 */
import { ISiteRepository } from '../domain/ISiteRepository'
import { Site } from '../domain/Site'
import { SiteStatus, parseSiteStatus } from '../domain/SiteStatus'
import { SiteType, parseSiteType } from '../domain/SiteType'
import { Pricing } from '../domain/Pricing'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'
import { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'

type SiteRow = Database['public']['Tables']['sites']['Row']

export class SupabaseSiteRepository implements ISiteRepository {
  private readonly supabase: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database> | SupabaseContext) {
    this.supabase = client instanceof SupabaseContext ? client.getRawClient() : client
  }

  async findById(id: string): Promise<Site | null> {
    const { data, error } = await this.supabase
      .from('sites')
      .select('*') // Complete entity - NO selective fetching!
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async findBySiteNumber(
    propertyId: string,
    siteNumber: string
  ): Promise<Site | null> {
    const { data, error } = await this.supabase
      .from('sites')
      .select('*')
      .eq('property_id', propertyId)
      .eq('site_number', siteNumber)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async findByPropertyId(propertyId: string): Promise<Site[]> {
    const { data, error } = await this.supabase
      .from('sites')
      .select('*')
      .eq('property_id', propertyId)
      .order('site_number', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row) => this.toDomain(row))
  }

  async findByPropertyIdWithFilters(
    propertyId: string,
    filters: {
      status?: SiteStatus
      siteType?: string
      availableOnly?: boolean
      limit?: number
      offset?: number
    }
  ): Promise<{ sites: Site[]; total: number }> {
    // Build query
    let query = this.supabase
      .from('sites')
      .select('*', { count: 'exact' })
      .eq('property_id', propertyId)

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.siteType) {
      query = query.eq('site_type', filters.siteType)
    }

    if (filters.availableOnly) {
      query = query.eq('status', SiteStatus.AVAILABLE)
    }

    // Apply pagination
    if (filters.limit) {
      const offset = filters.offset || 0
      query = query.range(offset, offset + filters.limit - 1)
    }

    // Order by site number
    query = query.order('site_number', { ascending: true })

    const { data, error, count } = await query

    if (error || !data) {
      return { sites: [], total: 0 }
    }

    return {
      sites: data.map((row) => this.toDomain(row)),
      total: count || 0,
    }
  }

  async findAvailableSites(propertyId: string): Promise<Site[]> {
    const { data, error } = await this.supabase
      .from('sites')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', SiteStatus.AVAILABLE)
      .order('site_number', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row) => this.toDomain(row))
  }

  async save(site: Site): Promise<void> {
    const persistence = site.toPersistence()

    // Check if exists
    const existing = await this.findById(site.id)

    if (existing) {
      // Update
      const { error } = await this.supabase
        .from('sites')
        .update(persistence)
        .eq('id', site.id)

      if (error) {
        throw new Error(`Failed to update site: ${error.message}`)
      }
    } else {
      // Insert
      const { error } = await this.supabase.from('sites').insert(persistence)

      if (error) {
        throw new Error(`Failed to create site: ${error.message}`)
      }
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('sites').delete().eq('id', id)

    if (error) {
      throw new Error(`Failed to delete site: ${error.message}`)
    }
  }

  async existsBySiteNumber(
    propertyId: string,
    siteNumber: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('sites')
      .select('id')
      .eq('property_id', propertyId)
      .eq('site_number', siteNumber)
      .single()

    return !error && data !== null
  }

  /**
   * Map database row to domain entity
   * CRITICAL: This expects ALL fields to be present (complete entity)
   */
  private toDomain(row: SiteRow): Site {
    // Parse enums
    const siteType = row.site_type ? parseSiteType(row.site_type) : SiteType.OTHER
    const status = row.status ? parseSiteStatus(row.status) : SiteStatus.AVAILABLE

    // Create pricing value object
    const pricing = Pricing.create(
      row.base_price || 0,
      row.weekend_price || row.base_price || 0,
      'USD'
    )

    // Parse JSON fields
    const amenities = this.parseJsonArray(row.amenities)
    const hookups = this.parseJsonArray(row.hookups)
    const images = this.parseJsonArray(row.images)
    const locationMap = this.parseJsonObject(row.location_map)

    // Reconstitute domain entity
    return Site.fromPersistence(
      row.id,
      row.property_id || '',
      row.site_number,
      row.site_name,
      siteType,
      pricing,
      row.max_occupancy,
      row.max_vehicles,
      row.size_sqft,
      status,
      row.description,
      amenities,
      hookups,
      images,
      locationMap,
      new Date(row.created_at || Date.now()),
      new Date(row.updated_at || Date.now())
    )
  }

  private parseJsonArray(value: any): string[] | null {
    if (!value) return null
    if (Array.isArray(value)) return value
    try {
      const parsed = JSON.parse(value as string)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  private parseJsonObject(value: any): Record<string, any> | null {
    if (!value) return null
    if (typeof value === 'object' && !Array.isArray(value)) return value
    try {
      const parsed = JSON.parse(value as string)
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

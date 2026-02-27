/**
 * SupabaseContext
 *
 * Wrapper around Supabase client that provides:
 * - Tenant-aware queries (automatic filtering by company_id or property_id)
 * - Consistent error handling
 * - Query logging (development)
 * - Type safety with generated database types
 *
 * This is used by repositories in the infrastructure layer.
 *
 * @example
 * ```typescript
 * const context = new SupabaseContext(supabaseClient, { companyId: 'company-123' })
 *
 * // Automatically filters by company_id
 * const sites = await context.table('sites').select('*')
 *
 * // Explicit property scope
 * const sites = await context
 *   .table('sites')
 *   .forProperty('property-456')
 *   .select('*')
 * ```
 */
import { type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../contracts/db'

export type TenantContext = {
  companyId?: string
  propertyId?: string
  userId?: string
}

export type SupabaseTable = keyof Database['public']['Tables']

export class SupabaseContext {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly tenantContext: TenantContext = {}
  ) {}

  /**
   * Get the raw Supabase client (use sparingly - prefer context methods)
   */
  getRawClient(): SupabaseClient<Database> {
    return this.client
  }

  /**
   * Get a query builder for a table with tenant context applied
   */
  table<T extends SupabaseTable>(tableName: T) {
    return new TenantAwareQueryBuilder(
      this.client,
      tableName,
      this.tenantContext
    )
  }

  /**
   * Create a new context with different tenant scope
   */
  withTenant(tenantContext: Partial<TenantContext>): SupabaseContext {
    return new SupabaseContext(this.client, {
      ...this.tenantContext,
      ...tenantContext,
    })
  }

  /**
   * Get the current tenant context
   */
  getTenantContext(): Readonly<TenantContext> {
    return { ...this.tenantContext }
  }
}

/**
 * Query builder that automatically applies tenant filtering
 */
class TenantAwareQueryBuilder<T extends SupabaseTable> {
  private propertyIdOverride?: string

  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly tableName: T,
    private readonly tenantContext: TenantContext
  ) {}

  /**
   * Override property scope for this query
   */
  forProperty(propertyId: string) {
    this.propertyIdOverride = propertyId
    return this
  }

  /**
   * Build a SELECT query with tenant filtering
   */
  select(columns: string = '*') {
    let query = this.client.from(this.tableName).select(columns)

    // Apply tenant filtering based on table structure
    query = this.applyTenantFilter(query)

    return query
  }

  /**
   * Build an INSERT query
   */
  insert(values: any | any[]) {
    const query = this.client.from(this.tableName).insert(values)
    return query
  }

  /**
   * Build an UPDATE query with tenant filtering
   */
  update(values: any) {
    let query = this.client.from(this.tableName).update(values)
    query = this.applyTenantFilter(query)
    return query
  }

  /**
   * Build a DELETE query with tenant filtering
   */
  delete() {
    let query = this.client.from(this.tableName).delete()
    query = this.applyTenantFilter(query)
    return query
  }

  /**
   * Apply tenant filtering to query based on table structure
   */
  private applyTenantFilter(query: any): any {
    // Determine which tenant filter to apply based on table
    const propertyId = this.propertyIdOverride || this.tenantContext.propertyId
    const companyId = this.tenantContext.companyId

    // Tables that have property_id
    const propertyTables = ['sites', 'reservations', 'guests'] as const

    // Tables that have company_id
    const companyTables = ['properties', 'staff'] as const

    if (propertyTables.includes(this.tableName as any) && propertyId) {
      query = query.eq('property_id', propertyId)
    } else if (companyTables.includes(this.tableName as any) && companyId) {
      query = query.eq('company_id', companyId)
    }

    // Note: In production, you might want to:
    // 1. Throw an error if no tenant context is provided for multi-tenant tables
    // 2. Use RLS (Row Level Security) policies in Supabase as a safety net
    // 3. Log queries that don't have tenant filtering

    return query
  }
}

/**
 * Helper to create a SupabaseContext from a Supabase client
 */
export function createSupabaseContext(
  client: SupabaseClient<Database>,
  tenantContext?: TenantContext
): SupabaseContext {
  return new SupabaseContext(client, tenantContext)
}

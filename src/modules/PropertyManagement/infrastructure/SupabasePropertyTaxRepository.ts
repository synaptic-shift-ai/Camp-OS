/**
 * SupabasePropertyTaxRepository
 *
 * Reads and writes `property_taxes`, `tax_applicability` and `tax_categories`.
 *
 * Following CLAUDE.md:
 * - D-1: accepts a raw client or a SupabaseContext
 * - D-2 / BP-4: every query carries an explicit property_id filter, because the
 *   settings and quote paths use the service-role client, which bypasses RLS
 * - D-3: RLS remains as the backstop for direct database access
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'
import type { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'
import type { IPropertyTaxRepository, TaxCategoryRecord } from '../domain/IPropertyTaxRepository'
import { PropertyTax, type PropertyTaxRow } from '../domain/PropertyTax'

/** Applicability joined to its category, as the grouping query returns it. */
type ApplicabilityRow = {
  property_tax_id: string
  tax_categories: { code: string } | { code: string }[] | null
}

function categoryCodeOf(row: ApplicabilityRow): string | null {
  const joined = row.tax_categories
  if (joined === null) return null
  // PostgREST returns an object for a to-one embed and an array for to-many;
  // which one depends on how it reads the composite foreign key, so handle both.
  const first = Array.isArray(joined) ? joined[0] : joined
  return first?.code ?? null
}

export class SupabasePropertyTaxRepository implements IPropertyTaxRepository {
  private readonly supabase: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database> | SupabaseContext) {
    this.supabase = 'getRawClient' in client ? client.getRawClient() : client
  }

  async findByPropertyId(propertyId: string): Promise<PropertyTax[]> {
    const { data: taxRows, error: taxError } = await this.supabase
      .from('property_taxes')
      .select('*')
      .eq('property_id', propertyId) // BP-4
      .is('deleted_at', null)
      .order('priority', { ascending: true })

    if (taxError) {
      throw new Error(`Failed to load taxes for property ${propertyId}: ${taxError.message}`)
    }
    if (!taxRows || taxRows.length === 0) return []

    const codesByTaxId = await this.loadCategoryCodes(
      propertyId,
      taxRows.map((row) => row.id),
    )

    return taxRows.map((row) =>
      PropertyTax.fromPersistence(row as PropertyTaxRow, codesByTaxId.get(row.id) ?? []),
    )
  }

  async findById(propertyId: string, taxId: string): Promise<PropertyTax | null> {
    const { data, error } = await this.supabase
      .from('property_taxes')
      .select('*')
      .eq('id', taxId)
      .eq('property_id', propertyId) // BP-4
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null

    const codesByTaxId = await this.loadCategoryCodes(propertyId, [taxId])
    return PropertyTax.fromPersistence(data as PropertyTaxRow, codesByTaxId.get(taxId) ?? [])
  }

  async save(tax: PropertyTax): Promise<void> {
    const row = tax.toPersistence()

    // One statement, so the tax and its applicability are never out of step.
    const { error } = await this.supabase.rpc('upsert_property_tax', {
      p_id: row.id,
      p_property_id: row.property_id,
      p_name: row.name,
      p_authority: row.authority,
      p_rate_type: row.rate_type,
      p_rate_bp: row.rate_bp,
      p_amount_cents: row.amount_cents,
      p_min_nights: row.min_nights,
      p_max_nights: row.max_nights,
      p_basis: row.basis,
      p_priority: row.priority,
      p_discounts_reduce_taxable_amount: row.discounts_reduce_taxable_amount,
      p_exemptible: row.exemptible,
      p_effective_from: row.effective_from,
      p_effective_to: row.effective_to,
      p_enabled: row.enabled,
      p_category_codes: [...tax.appliesToCategories],
    })

    if (error) {
      throw new Error(`Failed to save tax "${tax.name}": ${error.message}`)
    }
  }

  async softDelete(propertyId: string, taxId: string): Promise<void> {
    const { error } = await this.supabase
      .from('property_taxes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taxId)
      .eq('property_id', propertyId) // BP-4

    if (error) {
      throw new Error(`Failed to delete tax ${taxId}: ${error.message}`)
    }
  }

  async listCategories(propertyId: string): Promise<TaxCategoryRecord[]> {
    const { data, error } = await this.supabase
      .from('tax_categories')
      .select('*')
      .eq('property_id', propertyId) // BP-4
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to load tax categories for property ${propertyId}: ${error.message}`)
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      label: row.label,
      displayOrder: row.display_order,
    }))
  }

  /**
   * Category codes per tax, as a second query rather than a nested select.
   * Both tables are reached through composite foreign keys, which PostgREST
   * needs a constraint hint to embed through; two explicitly tenant-filtered
   * queries are plainer and cannot silently stop resolving.
   */
  private async loadCategoryCodes(
    propertyId: string,
    taxIds: readonly string[],
  ): Promise<Map<string, string[]>> {
    const { data, error } = await this.supabase
      .from('tax_applicability')
      .select('property_tax_id, tax_categories(code)')
      .eq('property_id', propertyId) // BP-4
      .in('property_tax_id', [...taxIds])

    if (error) {
      throw new Error(`Failed to load tax applicability for property ${propertyId}: ${error.message}`)
    }

    const codesByTaxId = new Map<string, string[]>()
    for (const row of (data ?? []) as unknown as ApplicabilityRow[]) {
      const code = categoryCodeOf(row)
      if (code === null) continue
      const existing = codesByTaxId.get(row.property_tax_id)
      if (existing) existing.push(code)
      else codesByTaxId.set(row.property_tax_id, [code])
    }
    return codesByTaxId
  }
}

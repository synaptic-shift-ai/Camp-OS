/**
 * PropertyTax Repository Interface
 *
 * Persistence contract for a property's configured taxes and the categories
 * they charge on. Every method takes `propertyId` explicitly: the settings and
 * quote paths both run on the service-role client, which bypasses RLS, so the
 * tenant filter has to be in the query (BP-4, D-2, D-3).
 */

import type { PropertyTax } from './PropertyTax'

/** A `tax_categories` row. Classification only — the rate lives on the tax. */
export type TaxCategoryRecord = {
  id: string
  code: string
  label: string
  displayOrder: number
}

export interface IPropertyTaxRepository {
  /**
   * Every tax configured for a property, enabled or not, with its category
   * codes resolved. Callers that price pass these to `selectApplicableTaxes`,
   * which does the enabling, gating and date filtering.
   */
  findByPropertyId(propertyId: string): Promise<PropertyTax[]>

  /** One tax, or null when it does not exist or belongs to another property. */
  findById(propertyId: string, taxId: string): Promise<PropertyTax | null>

  /**
   * Create or replace a tax together with its applicability, in one
   * transaction, so a tax is never stored without the categories it charges on.
   */
  save(tax: PropertyTax): Promise<void>

  /**
   * Soft-delete, so historical tax lines keep a row to point at. Prefer
   * disabling a tax that simply stopped being levied: `effective_to` and
   * `enabled` both express that without hiding it.
   */
  softDelete(propertyId: string, taxId: string): Promise<void>

  /** The property's charge categories, in display order. */
  listCategories(propertyId: string): Promise<TaxCategoryRecord[]>
}

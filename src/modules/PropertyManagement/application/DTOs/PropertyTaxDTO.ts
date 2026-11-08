/**
 * PropertyTax DTO
 *
 * The API shape of a configured tax. Camel-cased, with the rate left in basis
 * points rather than converted to a percentage: the client renders it, and a
 * decimal conversion here is how pricing_config.tax_rate ended up disagreeing
 * with financial_invoices.tax_rate in the first place.
 */

import type { PropertyTax } from '../../domain/PropertyTax'
import type { TaxCategoryRecord } from '../../domain/IPropertyTaxRepository'

export type PropertyTaxDTO = {
  id: string
  name: string
  authority: string | null
  rateType: string
  rateBp: number | null
  amountCents: number | null
  minNights: number | null
  maxNights: number | null
  basis: string
  priority: number
  discountsReduceTaxableAmount: boolean
  exemptible: boolean
  effectiveFrom: string | null
  effectiveTo: string | null
  enabled: boolean
  appliesToCategories: string[]
  createdAt: string
  updatedAt: string
}

export type TaxCategoryDTO = {
  id: string
  code: string
  label: string
  displayOrder: number
}

export function toPropertyTaxDTO(tax: PropertyTax): PropertyTaxDTO {
  return {
    id: tax.id,
    name: tax.name,
    authority: tax.authority,
    rateType: tax.rateType,
    rateBp: tax.rateBp,
    amountCents: tax.amountCents,
    minNights: tax.minNights,
    maxNights: tax.maxNights,
    basis: tax.basis,
    priority: tax.priority,
    discountsReduceTaxableAmount: tax.discountsReduceTaxableAmount,
    exemptible: tax.exemptible,
    effectiveFrom: tax.effectiveFrom,
    effectiveTo: tax.effectiveTo,
    enabled: tax.enabled,
    appliesToCategories: [...tax.appliesToCategories],
    createdAt: tax.createdAt.toISOString(),
    updatedAt: tax.updatedAt.toISOString(),
  }
}

export function toTaxCategoryDTO(category: TaxCategoryRecord): TaxCategoryDTO {
  return {
    id: category.id,
    code: category.code,
    label: category.label,
    displayOrder: category.displayOrder,
  }
}

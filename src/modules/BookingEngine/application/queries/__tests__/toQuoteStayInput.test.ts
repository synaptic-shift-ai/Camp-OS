/**
 * Tests for the quote input mapping.
 *
 * S-0.8: the mapping from database rows to QuoteStayInput was written three
 * times — once in the quote endpoint and twice in the create route. Adding a
 * configuration field and wiring it in only some of them would make a quoted
 * total diverge from a charged one without any test noticing, which is the
 * exact failure S-0 exists to prevent. One mapper makes that structural.
 */

import { describe, test, expect } from 'vitest'
import { toQuoteStayInput } from '../QuoteStayQuery'

const siteRow = {
  id: 'site-1',
  site_type: 'cabin',
  base_price: 12_000,
  weekly_rate_cents: 70_000,
  monthly_rate_cents: 260_000,
  pricing_override: { base_price: 12_000 },
  enabled_reservation_types_override: ['nightly', 'weekly'],
  // A column the quote does not consume, to prove the mapping is explicit.
  max_occupancy: 6,
}

const propertyRow = {
  id: 'prop-1',
  pricing_config: { tax_rate: 0.07 },
  rate_discounts_config: { user_defined_discounts: [] },
  reservation_type_config: { monthly: { min_nights: 30 } },
  site_type_config: { allowed_site_types: ['cabin'] },
  enabled_reservation_types: ['nightly', 'weekly'],
  // Likewise not consumed by pricing.
  owner_id: 'owner-1',
}

const stay = {
  checkInDate: '2026-06-15',
  checkOutDate: '2026-06-22',
  numberOfNights: 7,
  numAdults: 2,
  numChildren: 1,
  numPets: 1,
  taxes: [],
}

describe('toQuoteStayInput', () => {
  test('carries every site field the quote reads', () => {
    const { site } = toQuoteStayInput({ site: siteRow, property: propertyRow, ...stay })
    expect(site).toEqual({
      site_type: siteRow.site_type,
      base_price: siteRow.base_price,
      weekly_rate_cents: siteRow.weekly_rate_cents,
      monthly_rate_cents: siteRow.monthly_rate_cents,
      pricing_override: siteRow.pricing_override,
      enabled_reservation_types_override: siteRow.enabled_reservation_types_override,
    })
  })

  test('carries every property configuration field the quote reads', () => {
    const { property } = toQuoteStayInput({ site: siteRow, property: propertyRow, ...stay })
    expect(property).toEqual({
      pricing_config: propertyRow.pricing_config,
      rate_discounts_config: propertyRow.rate_discounts_config,
      reservation_type_config: propertyRow.reservation_type_config,
      site_type_config: propertyRow.site_type_config,
      enabled_reservation_types: propertyRow.enabled_reservation_types,
    })
  })

  test('maps no configuration field to undefined when the row provides it', () => {
    const { site, property } = toQuoteStayInput({
      site: siteRow,
      property: propertyRow,
      ...stay,
    })
    const unmapped = [
      ...Object.entries(site).filter(([, v]) => v === undefined).map(([k]) => `site.${k}`),
      ...Object.entries(property ?? {}).filter(([, v]) => v === undefined).map(([k]) => `property.${k}`),
    ]
    expect(unmapped).toEqual([])
  })

  test('carries the stay parameters through unchanged', () => {
    const result = toQuoteStayInput({ site: siteRow, property: propertyRow, ...stay })
    expect({
      checkInDate: result.checkInDate,
      checkOutDate: result.checkOutDate,
      numberOfNights: result.numberOfNights,
      numAdults: result.numAdults,
      numChildren: result.numChildren,
      numPets: result.numPets,
      taxes: result.taxes,
    }).toEqual(stay)
  })

  test('carries the configured taxes through, so the quote cannot be priced without them', () => {
    const lodgingTax = {
      id: 'tax-state',
      name: 'State Lodging Tax',
      authority: 'State Department of Taxation',
      rateType: 'percentage' as const,
      rateBp: 575,
      amountCents: null,
      minNights: null,
      maxNights: 29,
      basis: 'pre_tax' as const,
      priority: 0,
      discountsReduceTaxableAmount: true,
      exemptible: true,
      effectiveFrom: null,
      effectiveTo: null,
      enabled: true,
      appliesToCategories: ['lodging'],
    }
    const result = toQuoteStayInput({
      site: siteRow,
      property: propertyRow,
      ...stay,
      taxes: [lodgingTax],
    })
    expect(result.taxes).toEqual([lodgingTax])
  })

  test('tolerates a missing property, which the quote treats as unconfigured', () => {
    const { property } = toQuoteStayInput({ site: siteRow, property: null, ...stay })
    expect(property).toBeNull()
  })

  test('normalises absent site rate columns to null rather than undefined', () => {
    const sparse = { site_type: 'tent', base_price: null }
    const { site } = toQuoteStayInput({ site: sparse, property: null, ...stay })
    expect({
      base_price: site.base_price,
      weekly_rate_cents: site.weekly_rate_cents,
      monthly_rate_cents: site.monthly_rate_cents,
    }).toEqual({ base_price: null, weekly_rate_cents: null, monthly_rate_cents: null })
  })

  test('produces an input the quote can price without throwing', () => {
    const input = toQuoteStayInput({ site: siteRow, property: propertyRow, ...stay })
    expect(() => input).not.toThrow()
    expect(input.site.site_type).toBe('cabin')
  })
})

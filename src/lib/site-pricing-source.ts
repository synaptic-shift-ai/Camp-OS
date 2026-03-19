/**
 * Encoding for sites.enabled_reservation_types_override (JSON):
 * - { "source": "property_default" } = use property reservation_type_config
 * - { "source": "site_type_default" } = use property site_type_config for this site_type
 * - ["nightly", "weekly", "monthly"] = manual with these enabled types
 * - null/undefined = legacy; treat as property_default
 */

export type PricingSourceType = 'property_default' | 'site_type_default' | 'manual'

export type ParsedPricingSource =
  | { source: 'property_default' }
  | { source: 'site_type_default' }
  | { source: 'manual'; types: string[] }

const SOURCE_PROPERTY = 'property_default'
const SOURCE_SITE_TYPE = 'site_type_default'

function parseSourceField(v: unknown): PricingSourceType | undefined {
  if (typeof v !== 'string') return undefined
  if (v === 'manual') return 'manual'
  if (v === SOURCE_PROPERTY) return SOURCE_PROPERTY
  if (v === SOURCE_SITE_TYPE) return SOURCE_SITE_TYPE
  return undefined
}

function isObjectWithSource(v: unknown): v is { source: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    'source' in v &&
    typeof (v as { source: unknown }).source === 'string'
  )
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/**
 * Parse DB/API value into a known shape.
 * Backward compat: null/undefined → property_default.
 */
export function parsePricingSourceOverride(raw: unknown): ParsedPricingSource {
  if (raw == null) {
    return { source: SOURCE_PROPERTY }
  }
  if (isObjectWithSource(raw)) {
    const src = (raw as { source: string }).source
    if (src === SOURCE_SITE_TYPE) return { source: SOURCE_SITE_TYPE }
    return { source: SOURCE_PROPERTY }
  }
  if (isStringArray(raw)) {
    return { source: 'manual', types: raw }
  }
  return { source: SOURCE_PROPERTY }
}

/**
 * Parse pricing source from the new encoding in `sites.pricing_override`.
 *
 * Expected shape:
 * - `{ source: "property_default" | "site_type_default" | "manual" }`
 *
 * Returns `undefined` when parsing fails so callers can fall back to legacy encoding.
 */
export function parsePricingSourceFromPricingOverride(raw: unknown): PricingSourceType | undefined {
  if (raw == null) return undefined
  if (!isObjectWithSource(raw)) return undefined
  return parseSourceField((raw as { source: unknown }).source)
}

/**
 * Get pricing source type for display/branching.
 */
export function getPricingSourceType(raw: unknown): PricingSourceType
export function getPricingSourceType(
  pricingOverrideRaw: unknown,
  enabledReservationTypesOverrideRaw: unknown
): PricingSourceType
export function getPricingSourceType(
  arg1: unknown,
  arg2?: unknown
): PricingSourceType {
  // Legacy call signature: getPricingSourceType(enabled_reservation_types_override)
  if (arg2 === undefined) {
    return parsePricingSourceOverride(arg1).source
  }

  // New call signature: getPricingSourceType(pricing_override, enabled_reservation_types_override)
  const fromNew = parsePricingSourceFromPricingOverride(arg1)
  if (fromNew) return fromNew

  // Backward compat: fall back to legacy encoding stored in enabled_reservation_types_override
  return parsePricingSourceOverride(arg2).source
}

/**
 * Get enabled reservation types array only when source is 'manual'.
 * Otherwise returns undefined (use property or site-type config).
 */
export function getManualOverrideTypes(raw: unknown): string[] | undefined
export function getManualOverrideTypes(
  pricingOverrideRaw: unknown,
  enabledReservationTypesOverrideRaw: unknown
): string[] | undefined
export function getManualOverrideTypes(arg1: unknown, arg2?: unknown): string[] | undefined {
  // Legacy call signature: getManualOverrideTypes(enabled_reservation_types_override)
  if (arg2 === undefined) {
    const parsed = parsePricingSourceOverride(arg1)
    if (parsed.source === 'manual') return parsed.types
    return undefined
  }

  // New call signature.
  const source = getPricingSourceType(arg1, arg2)
  if (source !== 'manual') return undefined

  // In the new encoding, `enabled_reservation_types_override` should be the manual checkbox array.
  const rawEnabled = arg2
  if (isStringArray(rawEnabled)) return rawEnabled
  return undefined
}

/**
 * Serialize for DB/API from form/selection.
 * - property_default → { source: "property_default" }
 * - site_type_default → { source: "site_type_default" }
 * - manual → types array
 */
export function serializePricingSourceOverride(
  source: PricingSourceType,
  manualTypes?: string[]
): { source: string } | string[] | null {
  if (source === 'property_default') return { source: SOURCE_PROPERTY }
  if (source === 'site_type_default') return { source: SOURCE_SITE_TYPE }
  if (source === 'manual' && manualTypes && manualTypes.length > 0) return manualTypes
  return { source: SOURCE_PROPERTY }
}

/**
 * Serialize pricing source for the new `sites.pricing_override` column.
 * The caller should still store the manual checkbox array (if any) separately
 * in `sites.enabled_reservation_types_override`.
 */
export function serializePricingSourceForPricingOverride(
  source: PricingSourceType
): { source: PricingSourceType } {
  if (source === 'property_default') return { source: SOURCE_PROPERTY }
  if (source === 'site_type_default') return { source: SOURCE_SITE_TYPE }
  return { source: 'manual' }
}

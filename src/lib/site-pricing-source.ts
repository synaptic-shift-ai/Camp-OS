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
 * Get pricing source type for display/branching.
 */
export function getPricingSourceType(raw: unknown): PricingSourceType {
  return parsePricingSourceOverride(raw).source
}

/**
 * Get enabled reservation types array only when source is 'manual'.
 * Otherwise returns undefined (use property or site-type config).
 */
export function getManualOverrideTypes(raw: unknown): string[] | undefined {
  const parsed = parsePricingSourceOverride(raw)
  if (parsed.source === 'manual') return parsed.types
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

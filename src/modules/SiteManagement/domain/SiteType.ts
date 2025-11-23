/**
 * SiteType Enum
 *
 * Defines the types of campsites available.
 * IMPORTANT: Must match database schema exactly (src/contracts/db.ts)
 * Database constraint: 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'
 */
export enum SiteType {
  TENT = 'tent',
  RV = 'rv',
  CABIN = 'cabin',
  GLAMPING = 'glamping',
  YURT = 'yurt',
  OTHER = 'other',
}

export const SiteTypeLabels: Record<SiteType, string> = {
  [SiteType.TENT]: 'Tent Site',
  [SiteType.RV]: 'RV Site',
  [SiteType.CABIN]: 'Cabin',
  [SiteType.GLAMPING]: 'Glamping',
  [SiteType.YURT]: 'Yurt',
  [SiteType.OTHER]: 'Other',
}

/**
 * Parse site type from string (case-insensitive)
 */
export function parseSiteType(value: string): SiteType {
  const normalized = value.toLowerCase().trim()
  const type = Object.values(SiteType).find((t) => t === normalized)

  if (!type) {
    throw new Error(`Invalid site type: ${value}`)
  }

  return type as SiteType
}

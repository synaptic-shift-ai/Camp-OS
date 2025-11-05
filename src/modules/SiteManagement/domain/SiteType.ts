/**
 * SiteType Enum
 *
 * Defines the types of campsites available.
 */
export enum SiteType {
  TENT = 'tent',
  RV_NO_HOOKUP = 'rv_no_hookup',
  RV_WATER_ELECTRIC = 'rv_water_electric',
  RV_FULL_HOOKUP = 'rv_full_hookup',
  CABIN = 'cabin',
  GLAMPING = 'glamping',
  GROUP = 'group',
  OTHER = 'other',
}

export const SiteTypeLabels: Record<SiteType, string> = {
  [SiteType.TENT]: 'Tent Site',
  [SiteType.RV_NO_HOOKUP]: 'RV Site (No Hookups)',
  [SiteType.RV_WATER_ELECTRIC]: 'RV Site (Water & Electric)',
  [SiteType.RV_FULL_HOOKUP]: 'RV Site (Full Hookups)',
  [SiteType.CABIN]: 'Cabin',
  [SiteType.GLAMPING]: 'Glamping',
  [SiteType.GROUP]: 'Group Site',
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

export const GUEST_BOOKABLE_SITE_STATUSES = ['available', 'housekeeping', 'occupied'] as const

// ============================================================================
// Site types
//
// Single source of truth for the site type list and its display labels.
// Must stay in step with the database CHECK constraint, `SiteTypeSchema`
// (types/api/v1/schemas/sites.ts) and the `SiteType` domain enum
// (modules/SiteManagement/domain/SiteType.ts); constants.test.ts enforces that.
//
// Order is display order: RV first, Other last.
// ============================================================================

export const SITE_TYPES = ['rv', 'tent', 'cabin', 'glamping', 'yurt', 'other'] as const

export type SiteTypeValue = (typeof SITE_TYPES)[number]

/** Label form: `short` for form controls, `singular` for one site, `plural` for groups. */
export type SiteTypeLabelForm = 'short' | 'singular' | 'plural'

export const SITE_TYPE_LABELS: Record<SiteTypeValue, Record<SiteTypeLabelForm, string>> = {
  rv: { short: 'RV', singular: 'RV Site', plural: 'RV Sites' },
  tent: { short: 'Tent', singular: 'Tent Site', plural: 'Tent Sites' },
  cabin: { short: 'Cabin', singular: 'Cabin', plural: 'Cabins' },
  glamping: { short: 'Glamping', singular: 'Glamping', plural: 'Glamping' },
  yurt: { short: 'Yurt', singular: 'Yurt', plural: 'Yurts' },
  other: { short: 'Other', singular: 'Other', plural: 'Other Sites' },
}

/**
 * Display label for a stored site type.
 *
 * Matching is case-insensitive because the setup wizard historically wrote
 * capitalised values into `site_type_config.allowed_site_types`. An
 * unrecognised type returns the raw value, matching the previous
 * `siteTypeLabels[type] || type` behaviour of the call sites this replaced.
 */
export function siteTypeLabel(type: string, form: SiteTypeLabelForm = 'short'): string {
  const key = type?.toLowerCase() as SiteTypeValue
  return SITE_TYPE_LABELS[key]?.[form] ?? type
}

/** Options for select and checkbox controls, in display order. */
export const SITE_TYPE_OPTIONS: ReadonlyArray<{ value: SiteTypeValue; label: string }> =
  SITE_TYPES.map((value) => ({ value, label: SITE_TYPE_LABELS[value].short }))


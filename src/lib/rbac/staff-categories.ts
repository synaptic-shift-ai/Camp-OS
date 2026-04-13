/**
 * Staff categories for Camp-OS RBAC.
 *
 * Staff categories scope module access for the `staff` role only.
 * A staff member can hold multiple categories.
 * Manager+ implicitly gets access equivalent to the `all` category.
 *
 * Categories are stored as text in `property_role_categories.name` (not a DB enum).
 */

// ─── Category type ─────────────────────────────────────────────────────────────

export type StaffCategory =
  | 'housekeeping'
  | 'maintenance'
  | 'front_desk'
  | 'security'
  | 'marketing'
  | 'activities'
  | 'all'

/** All valid category strings. */
export const STAFF_CATEGORIES: ReadonlySet<string> = new Set<StaffCategory>([
  'housekeeping',
  'maintenance',
  'front_desk',
  'security',
  'marketing',
  'activities',
  'all',
])

/** Check whether an unknown string is a valid staff category. */
export function isStaffCategory(cat: string | null | undefined): cat is StaffCategory {
  if (!cat) return false
  return STAFF_CATEGORIES.has(cat)
}

/** Normalise an array of raw category strings, dropping invalid values. */
export function normaliseCategories(raw: (string | null | undefined)[] | null | undefined): StaffCategory[] {
  if (!raw || !Array.isArray(raw)) return []
  return raw.filter(isStaffCategory)
}

/** Check whether a user's categories include a target category (or 'all'). */
export function hasCategory(categories: readonly StaffCategory[], target: StaffCategory): boolean {
  return categories.includes('all') || categories.includes(target)
}

// ─── Category → permission mapping ─────────────────────────────────────────────

import type { PermissionKey } from './permissions'

/**
 * Permissions granted by each category to staff role users.
 * Manager+ users bypass this — they get their role's permission set directly.
 */
const CATEGORY_PERMISSIONS: Readonly<Record<StaffCategory, ReadonlySet<PermissionKey>>> = {
  housekeeping: new Set<PermissionKey>([
    'housekeeping.view_assigned',
    'housekeeping.start_complete',
  ]),
  maintenance: new Set<PermissionKey>([
    'maintenance.view_assigned',
    'maintenance.create_wo',
    'maintenance.update_assigned',
    'maintenance.request_onhold',
    'maintenance.enter_labor_cost',
  ]),
  front_desk: new Set<PermissionKey>([
    'reservations.read',
    'reservations.check_in',
    'reservations.check_out',
    'financial.view_balance',
    'financial.view_transactions',
    'financial.record_payment',
    'financial.create_charge',
    'guest_comms.view_delivery_log',
  ]),
  security: new Set<PermissionKey>([
    'gate_access.view_log',
    'gate_access.view_health',
    'gate_access.log_incident',
  ]),
  marketing: new Set<PermissionKey>([
    'marketing_seo.view_analytics',
    'marketing_seo.edit_listings',
    'marketing_seo.manage_photos',
    'marketing_seo.manage_reviews',
    'marketing_seo.view_campaigns',
  ]),
  activities: new Set<PermissionKey>([
    'activities.view',
    'activities.schedule',
    'activities.book',
  ]),
  all: new Set<PermissionKey>([
    // Housekeeping
    'housekeeping.view_assigned', 'housekeeping.start_complete',
    // Maintenance
    'maintenance.view_assigned', 'maintenance.create_wo', 'maintenance.update_assigned',
    'maintenance.request_onhold', 'maintenance.enter_labor_cost',
    // Front desk
    'reservations.read', 'reservations.check_in', 'reservations.check_out',
    'financial.view_balance', 'financial.view_transactions', 'financial.record_payment',
    'financial.create_charge', 'guest_comms.view_delivery_log',
    // Security
    'gate_access.view_log', 'gate_access.view_health', 'gate_access.log_incident',
    // Marketing
    'marketing_seo.view_analytics', 'marketing_seo.edit_listings', 'marketing_seo.manage_photos',
    'marketing_seo.manage_reviews', 'marketing_seo.view_campaigns',
    // Activities
    'activities.view', 'activities.schedule', 'activities.book',
  ]),
}

/** Get the permission set granted by a single category. */
export function getPermissionsForCategory(category: StaffCategory): ReadonlySet<PermissionKey> {
  return CATEGORY_PERMISSIONS[category] ?? new Set()
}

/**
 * Resolve the combined permission set for a staff user based on their categories.
 *
 * If `categories` is empty, the user has NO category-granted permissions.
 * If `categories` includes `'all'`, they get the union of all categories.
 * Otherwise, they get the union of their specific categories.
 */
export function resolveStaffPermissions(categories: readonly StaffCategory[]): ReadonlySet<PermissionKey> {
  if (categories.length === 0) return new Set()

  const combined = new Set<PermissionKey>()
  for (const cat of categories) {
    const perms = CATEGORY_PERMISSIONS[cat]
    if (perms) {
      for (const p of perms) combined.add(p)
    }
  }
  return combined
}

/**
 * Check whether a staff user's categories grant a specific permission.
 */
export function staffHasPermission(categories: readonly StaffCategory[], key: PermissionKey): boolean {
  return resolveStaffPermissions(categories).has(key)
}

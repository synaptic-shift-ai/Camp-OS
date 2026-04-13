/**
 * Role definitions for Camp-OS RBAC system.
 *
 * Canonical role types matching the DB CHECK constraint:
 *   property_staff.role IN ('owner', 'admin', 'property_admin', 'manager', 'staff')
 *
 * Hierarchy: platform_admin (50) > owner (40) ≥ admin (30) > manager (20) > staff (10)
 */

// ─── DB-level role (what is stored in the database) ────────────────────────────

/** All roles accepted by the `property_staff.role` CHECK constraint. */
export type DbRole = 'owner' | 'admin' | 'property_admin' | 'manager' | 'staff'

/** Set of valid DB role strings for runtime validation. */
export const DB_ROLES: ReadonlySet<string> = new Set<DbRole>([
  'owner',
  'admin',
  'property_admin',
  'manager',
  'staff',
])

/** Check whether an unknown string is a valid DB role. */
export function isDbRole(role: string | null | undefined): role is DbRole {
  if (!role) return false
  return DB_ROLES.has(role)
}

// ─── Effective role (normalised for application logic) ─────────────────────────

/**
 * Effective role used in application code.
 *
 * `property_admin` is normalised to `admin` everywhere except persistence.
 * This means the app only needs to handle 4 effective roles.
 */
export type EffectiveRole = 'owner' | 'admin' | 'manager' | 'staff'

/** Normalise a raw DB role string to an effective role. Invalid values map to `'staff'`. */
export function toEffectiveRole(dbRole: string | null | undefined): EffectiveRole {
  if (!dbRole) return 'staff'
  const r = dbRole.toLowerCase()
  if (r === 'owner') return 'owner'
  if (r === 'admin' || r === 'property_admin') return 'admin'
  if (r === 'manager') return 'manager'
  return 'staff'
}

// ─── Role rank ─────────────────────────────────────────────────────────────────

const ROLE_RANK: Readonly<Record<EffectiveRole, number>> = {
  owner: 40,
  admin: 30,
  manager: 20,
  staff: 10,
}

/** Return the numeric rank for a role. Higher = more authority. */
export function getRoleRank(role: EffectiveRole): number {
  return ROLE_RANK[role] ?? 0
}

/** True when `role` has at least as much authority as `minimum`. */
export function roleMeetsMinimum(role: EffectiveRole, minimum: EffectiveRole): boolean {
  return getRoleRank(role) >= getRoleRank(minimum)
}

// ─── Convenience predicates ────────────────────────────────────────────────────

/** `staff` role — no operational module access by default. */
export function isBasicStaff(role: EffectiveRole): boolean {
  return role === 'staff'
}

/** `admin`, `manager`, or `owner` — elevated operational access. */
export function isElevatedStaff(role: EffectiveRole): boolean {
  return role !== 'staff'
}

/** `owner` or `admin`. */
export function isOwnerOrAdmin(role: EffectiveRole): boolean {
  return role === 'owner' || role === 'admin'
}

/** `owner` only. */
export function isOwner(role: EffectiveRole): boolean {
  return role === 'owner'
}

/** `admin` or above (owner + admin). */
export function isAdminOrAbove(role: EffectiveRole): boolean {
  return role === 'owner' || role === 'admin'
}

/** `manager` or above (owner + admin + manager). */
export function isManagerOrAbove(role: EffectiveRole): boolean {
  return getRoleRank(role) >= ROLE_RANK.manager
}

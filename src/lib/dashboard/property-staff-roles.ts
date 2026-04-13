/** Basic `property_staff.role` assignment with no access to operational modules (reservations, sites, etc.). */
export function isBasicPropertyStaffRole(dbRole: string | null | undefined): boolean {
  if (!dbRole) return false
  return dbRole.toLowerCase() === 'staff'
}

/** Roles that may view the staff roster and manage invites, roles, and deactivation (not basic `staff`). */
export function isElevatedPropertyStaffRole(dbRole: string | null | undefined): boolean {
  if (!dbRole) return false
  const r = dbRole.toLowerCase()
  return (
    r === 'owner' ||
    r === 'admin' ||
    r === 'property_admin' ||
    r === 'manager'
  )
}

/** Property dashboard Settings (and related mutations) are denied for `staff` and `manager` assignments only. */
export function isPropertyStaffRoleBlockedFromPropertySettings(
  dbRole: string | null | undefined,
): boolean {
  if (!dbRole) return false
  const r = dbRole.toLowerCase()
  return r === 'staff' || r === 'manager'
}

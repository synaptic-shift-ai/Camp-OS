/**
 * Camp-OS RBAC Module
 *
 * Centralised role-based access control system.
 *
 * Quick start (in API route handlers):
 * ```ts
 * import { requirePropertyAccess, isDenied } from '@/lib/rbac'
 *
 * const access = await requirePropertyAccess(supabase, user.id, {
 *   propertyId,
 *   minimumRole: 'admin',
 *   permission: 'financial.refund',
 * })
 * if (isDenied(access)) return access
 * // access is now ResolvedAccess — use access.companyId, access.role, etc.
 * ```
 */

// Roles
export type {
  DbRole,
  EffectiveRole,
} from './roles'
export {
  isDbRole,
  toEffectiveRole,
  getRoleRank,
  roleMeetsMinimum,
  isBasicStaff,
  isElevatedStaff,
  isOwnerOrAdmin,
  isOwner,
  isAdminOrAbove,
  isManagerOrAbove,
} from './roles'

// Permissions
export type { PermissionKey } from './permissions'
export {
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  roleCanPerform,
} from './permissions'

// Staff categories
export type { StaffCategory } from './staff-categories'
export {
  isStaffCategory,
  normaliseCategories,
  hasCategory,
  getPermissionsForCategory,
  resolveStaffPermissions,
  staffHasPermission,
} from './staff-categories'

// Access resolution
export type { ResolvedAccess } from './resolve-access'
export { resolveUserPropertyAccess, resolveUserPropertyAccessOrThrow, AccessDeniedError } from './resolve-access'

// Route guards
export type { AccessRequirements } from './require-access'
export {
  checkPropertyAccess,
  requirePropertyMembership,
  requirePropertyAccess,
  isDenied,
} from './require-access'

// Dashboard guards
export {
  resolveDashboardAccess,
  canAccessOperationsModules,
  canAccessPropertySettings,
  canViewStaffRoster,
  canManageStaffRoster,
  canViewFinancials,
  canProcessRefunds,
  canAccessHousekeepingModule,
  canAccessMaintenanceModule,
} from './dashboard-guards'

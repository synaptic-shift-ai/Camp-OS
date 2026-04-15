/**
 * Server-side page guard functions for dashboard pages.
 *
 * These replace the individual guard files (operations-modules-page-access.ts,
 * property-settings-page-access.ts, staff-management-page-access.ts) with
 * RBAC-backed implementations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResolvedAccess } from '@/lib/rbac/resolve-access'
import { resolveUserPropertyAccess } from '@/lib/rbac/resolve-access'
import { isManagerOrAbove, isAdminOrAbove } from '@/lib/rbac/roles'
import { hasPermission } from '@/lib/rbac/permissions'
import { staffHasPermission } from '@/lib/rbac/staff-categories'

/**
 * Resolve access for a dashboard page. Returns null if no access.
 *
 * This replaces the multiple separate queries in the old guard functions
 * with a single `resolveUserPropertyAccess()` call.
 */
export async function resolveDashboardAccess(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
): Promise<ResolvedAccess | null> {
  return resolveUserPropertyAccess(supabase, propertyId, userId)
}

/**
 * Check if a user can access operations dashboard modules (reservations, sites, guests, etc.).
 *
 * Owner and manager+ only.
 */
export function canAccessOperationsModules(access: ResolvedAccess): boolean {
  if (!access.role) return false
  if (access.isOwner) return true
  if (isManagerOrAbove(access.role)) return true
  return false
}

/**
 * Check if a user can access property settings page.
 *
 * Admin+ only. Manager and staff cannot access settings.
 */
export function canAccessPropertySettings(access: ResolvedAccess): boolean {
  if (!access.role) return false
  return isAdminOrAbove(access.role)
}

export function canViewStaffRoster(access: ResolvedAccess): boolean {
  if (!access.role) return false
  return isManagerOrAbove(access.role)
}

/**
 * Housekeeping dashboard: owner/admin/manager, or staff with housekeeping category.
 */
export function canAccessHousekeepingModule(access: ResolvedAccess): boolean {
  if (!access.role) return false
  if (isManagerOrAbove(access.role)) return true
  return staffHasPermission(access.categories, 'housekeeping.view_assigned')
}

/**
 * Maintenance dashboard: owner/admin/manager, or staff with maintenance category.
 */
export function canAccessMaintenanceModule(access: ResolvedAccess): boolean {
  if (!access.role) return false
  if (isManagerOrAbove(access.role)) return true
  return staffHasPermission(access.categories, 'maintenance.view_assigned')
}

/**
 * Check if a user can manage the staff roster (invite, change roles, deactivate).
 *
 * Admin+ only.
 */
export function canManageStaffRoster(access: ResolvedAccess): boolean {
  if (!access.role) return false
  return isAdminOrAbove(access.role)
}

/**
 * Check if a user can manage staff access control payloads.
 *
 * Owner only.
 */
export function canManageStaffAccess(access: ResolvedAccess): boolean {
  if (!access.role) return false
  return access.role === 'owner'
}

/**
 * Check if a user can view financial data (transactions, balances, reports).
 *
 * Admin+ always. Manager+ by role permission.
 */
export function canViewFinancials(access: ResolvedAccess): boolean {
  if (!access.role) return false
  if (access.isOwner) return true
  if (hasPermission(access.role, 'financial.view_balance')) return true
  return false
}

/**
 * Check if a user can process refunds.
 *
 * Admin+ only.
 */
export function canProcessRefunds(access: ResolvedAccess): boolean {
  if (!access.role) return false
  return isAdminOrAbove(access.role)
}

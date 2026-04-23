/**
 * Resolves RBAC permission keys from `property_role_categories.access` JSON
 * (module access control). Shared by `/api/v1/me/permissions` and staff-management APIs.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PermissionKey } from '@/lib/rbac/permissions'
import type { UiRole } from '@/lib/dashboard/staff-management-queries'
import type { RoleAccessControlModuleKey } from '@/lib/dashboard/dashboard-nav-modules'

export type RoleCategoryAccessPayload = {
  selectedModuleKey?: string
  moduleAccessControl?: Record<string, Record<string, boolean>>
} | null

export function normalizeAccessPayload(raw: unknown): RoleCategoryAccessPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const maybe = raw as {
    selectedModuleKey?: unknown
    moduleAccessControl?: unknown
  }
  const selectedModuleKey =
    typeof maybe.selectedModuleKey === 'string' ? maybe.selectedModuleKey : undefined
  const moduleAccessControl =
    maybe.moduleAccessControl &&
    typeof maybe.moduleAccessControl === 'object' &&
    !Array.isArray(maybe.moduleAccessControl)
      ? (maybe.moduleAccessControl as Record<string, Record<string, boolean>>)
      : undefined
  const normalized: NonNullable<RoleCategoryAccessPayload> = {}
  if (selectedModuleKey) normalized.selectedModuleKey = selectedModuleKey
  if (moduleAccessControl) normalized.moduleAccessControl = moduleAccessControl
  return normalized
}

export const ROLE_CATEGORY_MODULE_PERMISSION_TO_RBAC: Partial<
  Record<RoleAccessControlModuleKey, Partial<Record<string, PermissionKey>>>
> = {
  'account-profile': {
    view: 'global.view_own_profile',
    edit: 'global.edit_own_profile',
    'view-company': 'global.view_company',
    'change-password': 'global.change_password',
  },
  'staff-management': {
    view: 'global.view_staff_list',
    invite: 'global.invite_staff',
    edit: 'global.change_staff_role',
    deactivate: 'global.deactivate_staff',
    'manage-access': 'global.manage_staff_module_access',
  },
  reservations: {
    view: 'reservations.read',
    create: 'reservations.create',
    modify: 'reservations.update',
    'check-in': 'reservations.check_in',
    'check-out': 'reservations.check_out',
    cancel: 'reservations.cancel',
  },
  payments: {
    view: 'financial.view_transactions',
  },
  housekeeping: {
    view: 'housekeeping.view_assigned',
    create: 'housekeeping.create_manual',
    update: 'housekeeping.start_complete',
    delete: 'housekeeping.reassign',
  },
  maintenance: {
    view: 'maintenance.view_assigned',
    create: 'maintenance.create_wo',
    update: 'maintenance.update_assigned',
    delete: 'maintenance.update_assigned',
    'assign-wo': 'maintenance.assign_wo',
    'request-onhold': 'maintenance.request_onhold',
    'approve-onhold': 'maintenance.approve_onhold',
    'cancel-wo': 'maintenance.cancel_wo',
    'manage-vendors': 'maintenance.manage_vendors',
    'manage-pm-schedules': 'maintenance.manage_pm_schedules',
    'view-cost-reports': 'maintenance.view_cost_reports',
  },
  analytics: {
    view: 'marketing_seo.view_analytics',
  },
  auditing: {
    view: 'docs.view_acknowledgment_log',
  },
  settings: {
    view: 'global.manage_property_settings',
    edit: 'global.manage_property_settings',
  },
}

export function toUiRoleFromStaffAssignment(rawRole: string | null): UiRole {
  const normalized = (rawRole ?? '').toLowerCase()
  if (normalized === 'owner') return 'owner'
  if (normalized === 'admin' || normalized === 'property_admin') return 'admin'
  if (normalized === 'manager') return 'manager'
  return 'staff'
}

export function buildDefaultAccessForRoleCategory(
  role: UiRole,
  categoryName: string,
): Record<string, Record<string, boolean>> {
  const category = categoryName.trim().toLowerCase()

  if (role === 'owner' || role === 'admin') {
    return {
      'account-profile': {
        view: true,
        edit: true,
        'view-company': true,
        'change-password': true,
      },
      'staff-management': { view: true, invite: true, edit: true, deactivate: true },
      reservations: {
        view: true,
        create: true,
        modify: true,
        'check-in': true,
        'check-out': true,
        cancel: true,
      },
      payments: { view: true },
      housekeeping: { view: true, create: true, update: true, delete: true },
      maintenance: {
        view: true,
        create: true,
        update: true,
        delete: true,
        'assign-wo': true,
        'request-onhold': true,
        'approve-onhold': true,
        'cancel-wo': true,
        'manage-vendors': true,
        'manage-pm-schedules': true,
        'view-cost-reports': true,
      },
      analytics: { view: true },
      auditing: { view: true },
      settings: { view: true, edit: true },
    }
  }

  if (role === 'manager' && category === 'front desk') {
    return {
      'account-profile': {
        view: true,
        edit: true,
        'view-company': true,
        'change-password': true,
      },
      'staff-management': { view: true },
      reservations: { view: true, 'check-in': true, 'check-out': true },
    }
  }

  if (role === 'manager' && category === 'housekeeping') {
    return {
      'account-profile': {
        view: true,
        edit: true,
        'view-company': true,
        'change-password': true,
      },
      'staff-management': { view: true },
      housekeeping: { view: true, create: true, update: true, delete: true },
    }
  }

  if (role === 'manager' && category === 'maintenance') {
    return {
      'account-profile': {
        view: true,
        edit: true,
        'view-company': true,
        'change-password': true,
      },
      'staff-management': { view: true },
      maintenance: {
        view: true,
        create: true,
        update: true,
        delete: true,
        'assign-wo': true,
        'request-onhold': true,
        'approve-onhold': true,
        'cancel-wo': true,
        'manage-vendors': true,
        'manage-pm-schedules': true,
        'view-cost-reports': true,
      },
    }
  }

  if (role === 'staff' && category === 'front desk') {
    return {
      'account-profile': {
        view: true,
        edit: true,
        'view-company': true,
        'change-password': true,
      },
      reservations: { view: true, 'check-in': true, 'check-out': true },
    }
  }

  if (role === 'staff' && category === 'housekeeping') {
    return {
      'account-profile': {
        view: true,
        edit: true,
        'view-company': true,
        'change-password': true,
      },
      overview: { view: true },
      housekeeping: { view: true },
    }
  }

  if (role === 'staff' && category === 'maintenance') {
    return {
      'account-profile': {
        view: true,
        edit: true,
        'view-company': true,
        'change-password': true,
      },
      overview: { view: true },
      maintenance: { view: true, create: true, update: true },
    }
  }

  return {}
}

export function resolvePermissionsFromCategoryAccess(
  role: UiRole,
  categories: Array<{ name: string; access: RoleCategoryAccessPayload }>,
): ReadonlySet<PermissionKey> {
  const resolved = new Set<PermissionKey>()
  for (const category of categories) {
    const defaultAccessMap = buildDefaultAccessForRoleCategory(role, category.name)
    const explicitAccessMap = category.access?.moduleAccessControl ?? {}
    const moduleKeys = new Set<string>([
      ...Object.keys(defaultAccessMap),
      ...Object.keys(explicitAccessMap),
    ])

    for (const moduleKey of moduleKeys) {
      const perms = {
        ...(defaultAccessMap[moduleKey] ?? {}),
        ...(explicitAccessMap[moduleKey] ?? {}),
      }
      const modulePermissions =
        ROLE_CATEGORY_MODULE_PERMISSION_TO_RBAC[moduleKey as RoleAccessControlModuleKey]
      if (!modulePermissions) continue
      for (const [permissionId, enabled] of Object.entries(perms ?? {})) {
        if (!enabled) continue
        const mapped = modulePermissions[permissionId]
        if (mapped) resolved.add(mapped)
      }
    }
  }
  return resolved
}

/**
 * Permission keys derived from the signed-in user's assigned role categories
 * (`property_role_categories.access.moduleAccessControl`), merged with role/category defaults.
 */
export async function fetchCategoryDerivedPermissionKeys(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
  rawRoleFallback: string | null,
): Promise<ReadonlySet<PermissionKey>> {
  const { data: staffAssignment } = await supabase
    .from('property_staff')
    .select('role, role_category_id')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .maybeSingle()

  const assignedCategoryIds = staffAssignment?.role_category_id ?? []
  if (!Array.isArray(assignedCategoryIds) || assignedCategoryIds.length === 0) {
    return new Set()
  }

  const role = toUiRoleFromStaffAssignment(
    typeof staffAssignment?.role === 'string' ? staffAssignment.role : rawRoleFallback,
  )

  const { data: categoryRows } = await supabase
    .from('property_role_categories')
    .select('id, name, access')
    .eq('property_id', propertyId)
    .eq('role', role)
    .in('id', assignedCategoryIds)

  if (!Array.isArray(categoryRows) || categoryRows.length === 0) {
    return new Set()
  }

  const normalized = categoryRows.map((row) => ({
    name: row.name,
    access: normalizeAccessPayload(row.access),
  }))
  return resolvePermissionsFromCategoryAccess(role, normalized)
}

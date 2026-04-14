import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { resolveUserPropertyAccessOrThrow, AccessDeniedError } from '@/lib/rbac'
import { getPermissionsForRole } from '@/lib/rbac/permissions'
import { resolveStaffPermissions } from '@/lib/rbac/staff-categories'
import type { PermissionKey } from '@/lib/rbac/permissions'
import type { UiRole } from '@/lib/dashboard/staff-management-queries'
import type { RoleAccessControlModuleKey } from '@/lib/dashboard/dashboard-nav-modules'

type RoleCategoryAccessPayload = {
  selectedModuleKey?: string
  moduleAccessControl?: Record<string, Record<string, boolean>>
} | null

function normalizeAccessPayload(raw: unknown): RoleCategoryAccessPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const maybe = raw as {
    selectedModuleKey?: unknown
    moduleAccessControl?: unknown
  }
  const selectedModuleKey =
    typeof maybe.selectedModuleKey === 'string'
      ? maybe.selectedModuleKey
      : undefined
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

const MODULE_PERMISSION_TO_RBAC: Partial<Record<RoleAccessControlModuleKey, Partial<Record<string, PermissionKey>>>> = {
  'account-profile': {
    view: 'global.view_own_profile',
    'change-password': 'global.change_password',
  },
  'staff-management': {
    view: 'global.view_staff_list',
    invite: 'global.invite_staff',
    edit: 'global.change_staff_role',
    deactivate: 'global.deactivate_staff',
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
  },
  maintenance: {
    view: 'maintenance.view_assigned',
    create: 'maintenance.create_wo',
    update: 'maintenance.update_assigned',
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

function toUiRole(rawRole: string | null): UiRole {
  const normalized = (rawRole ?? '').toLowerCase()
  if (normalized === 'owner') return 'owner'
  if (normalized === 'admin' || normalized === 'property_admin') return 'admin'
  if (normalized === 'manager') return 'manager'
  return 'staff'
}

function buildDefaultAccessForRoleCategory(
  role: UiRole,
  categoryName: string,
): Record<string, Record<string, boolean>> {
  const category = categoryName.trim().toLowerCase()

  if (role === 'owner' || role === 'admin') {
    return {
      'account-profile': { view: true, 'change-password': true },
      'staff-management': { view: true, invite: true, edit: true, deactivate: true },
      reservations: { view: true, create: true, modify: true, 'check-in': true, 'check-out': true, cancel: true },
      payments: { view: true },
      housekeeping: { view: true, create: true, update: true },
      maintenance: { view: true, create: true, update: true },
      analytics: { view: true },
      auditing: { view: true },
      settings: { view: true, edit: true },
    }
  }

  if (role === 'manager' && category === 'front desk') {
    return {
      'account-profile': { view: true, 'change-password': true },
      'staff-management': { view: true },
      reservations: { view: true, 'check-in': true, 'check-out': true },
    }
  }

  if (role === 'manager' && category === 'housekeeping') {
    return {
      'account-profile': { view: true, 'change-password': true },
      'staff-management': { view: true },
      housekeeping: { view: true, create: true, update: true },
    }
  }

  if (role === 'manager' && category === 'maintenance') {
    return {
      'account-profile': { view: true, 'change-password': true },
      'staff-management': { view: true },
      maintenance: { view: true, create: true, update: true },
    }
  }

  if (role === 'staff' && category === 'front desk') {
    return {
      'account-profile': { view: true, 'change-password': true },
      reservations: { view: true, 'check-in': true, 'check-out': true },
    }
  }

  if (role === 'staff' && category === 'housekeeping') {
    return {
      'account-profile': { view: true, 'change-password': true },
      overview: { view: true },
      housekeeping: { view: true },
    }
  }

  if (role === 'staff' && category === 'maintenance') {
    return {
      'account-profile': { view: true, 'change-password': true },
      overview: { view: true },
      maintenance: { view: true },
    }
  }

  return {}
}

function resolvePermissionsFromCategoryAccess(
  role: UiRole,
  categories: Array<{ name: string; access: RoleCategoryAccessPayload }>,
): ReadonlySet<PermissionKey> {
  const resolved = new Set<PermissionKey>()
  for (const category of categories) {
    const accessMap =
      category.access?.moduleAccessControl ??
      buildDefaultAccessForRoleCategory(role, category.name)

    for (const [moduleKey, perms] of Object.entries(accessMap)) {
      const modulePermissions =
        MODULE_PERMISSION_TO_RBAC[moduleKey as RoleAccessControlModuleKey]
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
 * GET /api/v1/me/permissions?propertyId=...
 *
 * Returns the current user's resolved role, categories, and permissions for a property.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const propertyId = request.nextUrl.searchParams.get('propertyId')?.trim() ?? ''

    if (!propertyId) {
      return error(
        ErrorCodes.VALIDATION_ERROR.code,
        'propertyId query parameter is required',
        ErrorCodes.VALIDATION_ERROR.status,
        request,
      )
    }

    const access = await resolveUserPropertyAccessOrThrow(
      supabase as any,
      propertyId,
      user.id,
      user.user_metadata,
    )

    // Build permission set: role permissions + staff category permissions
    const rolePerms = access.role ? getPermissionsForRole(access.role) : new Set<string>()
    const categoryPerms = access.categories.length > 0
      ? resolveStaffPermissions(access.categories)
      : new Set<string>()
    let allPerms = new Set([...rolePerms, ...categoryPerms])

    // If the user has assigned role categories, resolve permissions from
    // property_role_categories.access JSON first, with fallback defaults when empty.
    const { data: staffAssignment } = await supabase
      .from('property_staff')
      .select('role, role_category_id')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .in('status', ['active', 'pending'])
      .maybeSingle()

    const assignedCategoryIds = staffAssignment?.role_category_id ?? []
    if (Array.isArray(assignedCategoryIds) && assignedCategoryIds.length > 0) {
      const role = toUiRole(typeof staffAssignment?.role === 'string' ? staffAssignment.role : access.rawRole)
      const { data: categoryRows } = await supabase
        .from('property_role_categories')
        .select('id, name, access')
        .eq('property_id', propertyId)
        .eq('role', role)
        .in('id', assignedCategoryIds)

      if (Array.isArray(categoryRows) && categoryRows.length > 0) {
        const normalized = categoryRows.map((row) => ({
          name: row.name,
          access: normalizeAccessPayload(row.access),
        }))
        allPerms = new Set(resolvePermissionsFromCategoryAccess(role, normalized))
      }
    }

    const payload = {
        role: access.role,
        rawRole: access.rawRole,
        categories: access.categories,
        permissions: [...allPerms],
        isOwner: access.isOwner,
        isElevated: access.isElevated,
        isPlatformAdmin: access.isPlatformAdmin,
      }

    return NextResponse.json(
      { success: true, data: payload },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=30',
        },
      },
    )
  } catch (err: unknown) {
    if (err instanceof AccessDeniedError) {
      return error(
        err.statusCode === 404 ? ErrorCodes.AUTH_003 : ErrorCodes.AUTH_002,
        request,
      )
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[me/permissions] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { resolveUserPropertyAccess } from '@/lib/rbac/resolve-access'
import {
  DASHBOARD_NAV_MODULES,
  DASHBOARD_ROLE_ACCESS_MODULES,
  type DashboardNavModuleKey,
  type RoleAccessControlModuleKey,
} from '@/lib/dashboard/dashboard-nav-modules'
import {
  canAccessOperationsModules,
  canAccessPropertySettings,
  canViewFinancials,
  canViewStaffRoster,
  canAccessHousekeepingModule,
  canAccessMaintenanceModule,
  canAccessAutomationsModule,
} from '@/lib/rbac/dashboard-guards'
import type { UiRole } from '@/lib/dashboard/staff-management-queries'

export type DashboardNavVisibility = {
  /** Operations modules (reservations, sites, guests, auditing, analytics) */
  operationsModulesNavVisible: boolean
  /** Staff Management sidebar link — mirrors `moduleNavVisible['staff-management']` */
  staffManagementNavVisible: boolean
  /** Property settings page */
  propertySettingsNavVisible: boolean
  /** Payments sidebar link — mirrors `moduleNavVisible['payments']` */
  financialNavVisible: boolean
  /** Housekeeping module page */
  housekeepingNavVisible: boolean
  /** Maintenance module page */
  maintenanceNavVisible: boolean
  /** Account profile page visibility */
  accountProfileNavVisible: boolean
  /** Per-module nav visibility for sidebar rendering */
  moduleNavVisible: Record<DashboardNavModuleKey, boolean>
}

type RoleCategoryAccessPayload = {
  moduleAccessControl?: Record<string, Record<string, boolean>>
} | null

function toUiRole(rawRole: string | null): UiRole {
  const normalized = (rawRole ?? '').toLowerCase()
  if (normalized === 'owner') return 'owner'
  if (normalized === 'admin' || normalized === 'property_admin') return 'admin'
  if (normalized === 'manager') return 'manager'
  return 'staff'
}

function fallbackModuleViewForRoleCategory(
  role: UiRole,
  categoryName: string,
  moduleKey: RoleAccessControlModuleKey,
): boolean {
  const category = categoryName.trim().toLowerCase()

  if (role === 'owner' || role === 'admin') return true

  if (role === 'manager' && category === 'front desk') {
    return (
      moduleKey === 'overview' ||
      moduleKey === 'staff-management' ||
      moduleKey === 'reservations' ||
      moduleKey === 'sites' ||
      moduleKey === 'guests' ||
      moduleKey === 'automations'
    )
  }
  if (role === 'manager' && category === 'housekeeping') {
    return (
      moduleKey === 'overview' ||
      moduleKey === 'staff-management' ||
      moduleKey === 'sites' ||
      moduleKey === 'housekeeping' ||
      moduleKey === 'automations'
    )
  }
  if (role === 'manager' && category === 'maintenance') {
    return (
      moduleKey === 'overview' ||
      moduleKey === 'staff-management' ||
      moduleKey === 'sites' ||
      moduleKey === 'maintenance' ||
      moduleKey === 'automations'
    )
  }

  if (role === 'staff' && category === 'front desk') {
    return moduleKey === 'overview'
  }

  if (role === 'staff' && category === 'housekeeping') {
    return moduleKey === 'overview' || moduleKey === 'housekeeping'
  }
  if (role === 'staff' && category === 'maintenance') {
    return moduleKey === 'overview' || moduleKey === 'maintenance'
  }

  if (role === 'staff') {
    return moduleKey === 'overview' || moduleKey === 'account-profile'
  }

  if (role === 'manager') {
    return moduleKey === 'overview' || moduleKey === 'account-profile' || moduleKey === 'automations'
  }

  return false
}

function normalizeAccessPayload(raw: unknown): RoleCategoryAccessPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const maybe = raw as { moduleAccessControl?: unknown }
  if (
    !maybe.moduleAccessControl ||
    typeof maybe.moduleAccessControl !== 'object' ||
    Array.isArray(maybe.moduleAccessControl)
  ) {
    return null
  }
  return {
    moduleAccessControl: maybe.moduleAccessControl as Record<string, Record<string, boolean>>,
  }
}

async function resolveCategoryBasedModuleNavVisibility(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
): Promise<{
  hasCategoryAssignments: boolean
  role: UiRole | null
  moduleAccessVisible: Record<RoleAccessControlModuleKey, boolean>
}> {
  const emptyVisibility = Object.fromEntries(
    DASHBOARD_ROLE_ACCESS_MODULES.map((mod) => [mod.key, false]),
  ) as Record<RoleAccessControlModuleKey, boolean>

  const { data: staffAssignment } = await supabase
    .from('property_staff')
    .select('role, role_category_id')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .maybeSingle()

  const categoryIds = staffAssignment?.role_category_id ?? []
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    return { hasCategoryAssignments: false, role: null, moduleAccessVisible: emptyVisibility }
  }

  const role = toUiRole(typeof staffAssignment?.role === 'string' ? staffAssignment.role : null)
  const { data: categoryRows } = await supabase
    .from('property_role_categories')
    .select('name, access')
    .eq('property_id', propertyId)
    .eq('role', role)
    .in('id', categoryIds)

  const rows = categoryRows ?? []
  const moduleAccessVisible = { ...emptyVisibility }

  for (const mod of DASHBOARD_ROLE_ACCESS_MODULES) {
    // Automations uses 'view-dashboard' as its primary view permission, all other modules use 'view'
    const viewPermKey = mod.key === 'automations' ? 'view-dashboard' : 'view'
    moduleAccessVisible[mod.key] = rows.some((row) => {
      const access = normalizeAccessPayload(row.access)
      const explicitView = access?.moduleAccessControl?.[mod.key]?.[viewPermKey]
      if (typeof explicitView === 'boolean') {
        return explicitView
      }
      return fallbackModuleViewForRoleCategory(role, row.name ?? '', mod.key)
    })
  }

  return { hasCategoryAssignments: true, role, moduleAccessVisible }
}

export async function isStaffAssignmentInactiveForProperty(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('property_staff')
    .select('status')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data?.status) return false
  return String(data.status).toLowerCase() === 'inactive'
}

export async function resolveDashboardNavVisibility(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
): Promise<DashboardNavVisibility> {
  const access = await resolveUserPropertyAccess(supabase, propertyId, userId)

  if (!access) {
    // No property access — hide all restricted nav items
    return {
      operationsModulesNavVisible: false,
      staffManagementNavVisible: false,
      propertySettingsNavVisible: false,
      financialNavVisible: false,
      housekeepingNavVisible: false,
      maintenanceNavVisible: false,
      accountProfileNavVisible: false,
      moduleNavVisible: Object.fromEntries(
        DASHBOARD_NAV_MODULES.map((mod) => [mod.key, false]),
      ) as Record<DashboardNavModuleKey, boolean>,
    }
  }

  const categoryBasedNav = await resolveCategoryBasedModuleNavVisibility(
    supabase,
    propertyId,
    userId,
  )

  const roleBasedModuleAccessVisible = {
    overview: true,
    reservations: canAccessOperationsModules(access),
    sites: canAccessOperationsModules(access),
    guests: canAccessOperationsModules(access),
    payments: canViewFinancials(access),
    analytics: canAccessOperationsModules(access),
    housekeeping: canAccessHousekeepingModule(access),
    maintenance: canAccessMaintenanceModule(access),
    automations: canAccessAutomationsModule(access),
    'staff-management': canViewStaffRoster(access),
    auditing: canAccessOperationsModules(access),
    settings: canAccessPropertySettings(access),
    'account-profile': true,
  } satisfies Record<RoleAccessControlModuleKey, boolean>

  const shouldUseCategoryBasedModules =
    categoryBasedNav.hasCategoryAssignments &&
    (categoryBasedNav.role === 'staff' ||
      categoryBasedNav.role === 'manager' ||
      categoryBasedNav.role === 'admin')

  const moduleAccessVisible = shouldUseCategoryBasedModules
    ? categoryBasedNav.moduleAccessVisible
    : roleBasedModuleAccessVisible

  const moduleNavVisible = Object.fromEntries(
    DASHBOARD_NAV_MODULES.map((mod) => [mod.key, moduleAccessVisible[mod.key]]),
  ) as Record<DashboardNavModuleKey, boolean>

  return {
    operationsModulesNavVisible: canAccessOperationsModules(access),
    staffManagementNavVisible: moduleNavVisible['staff-management'],
    propertySettingsNavVisible: canAccessPropertySettings(access),
    financialNavVisible: moduleNavVisible['payments'],
    housekeepingNavVisible: moduleNavVisible.housekeeping,
    maintenanceNavVisible: moduleNavVisible.maintenance,
    accountProfileNavVisible: moduleAccessVisible['account-profile'],
    moduleNavVisible,
  }
}

export type DashboardUserLabels = {
  displayName: string
  roleLabel: string
  isStaffUserType: boolean
}

export async function resolveDashboardUserLabels(
  supabase: SupabaseClient,
  user: User,
  propertyId?: string,
): Promise<DashboardUserLabels> {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const userType = typeof metadata.user_type === 'string' ? metadata.user_type.trim().toLowerCase() : ''
  const isStaffUserType = userType === 'staff'
  const firstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : ''
  const lastName = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const fallbackName =
    typeof metadata.full_name === 'string'
      ? metadata.full_name
      : typeof metadata.name === 'string'
        ? metadata.name
        : ''
  const displayName = fullName || fallbackName || user.email || 'User'

  const { data: ownerCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  let roleLabel = ownerCompany?.id ? 'Owner' : 'User'

  if (!ownerCompany?.id && propertyId && propertyId.length > 0) {
    const access = await resolveUserPropertyAccess(supabase, propertyId, user.id)
    if (access?.role) {
      roleLabel = `${access.role.charAt(0).toUpperCase()}${access.role.slice(1)}`
    }
  }

  return { displayName, roleLabel, isStaffUserType }
}

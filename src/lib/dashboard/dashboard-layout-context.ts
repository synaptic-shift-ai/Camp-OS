import type { SupabaseClient, User } from '@supabase/supabase-js'
import { resolveUserPropertyAccess } from '@/lib/rbac/resolve-access'
import {
  canAccessOperationsModules,
  canAccessPropertySettings,
  canViewFinancials,
  canViewStaffRoster,
  canAccessHousekeepingModule,
  canAccessMaintenanceModule,
} from '@/lib/rbac/dashboard-guards'

export type DashboardNavVisibility = {
  /** Operations modules (reservations, sites, guests, auditing, analytics) */
  operationsModulesNavVisible: boolean
  /** Staff management page */
  staffManagementNavVisible: boolean
  /** Property settings page */
  propertySettingsNavVisible: boolean
  /** Financial pages (transactions, refunds, deposits) — NEW */
  financialNavVisible: boolean
  /** Housekeeping module page */
  housekeepingNavVisible: boolean
  /** Maintenance module page */
  maintenanceNavVisible: boolean
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
    }
  }

  return {
    operationsModulesNavVisible: canAccessOperationsModules(access),
    staffManagementNavVisible: canViewStaffRoster(access),
    propertySettingsNavVisible: canAccessPropertySettings(access),
    financialNavVisible: canViewFinancials(access),
    housekeepingNavVisible: canAccessHousekeepingModule(access),
    maintenanceNavVisible: canAccessMaintenanceModule(access),
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

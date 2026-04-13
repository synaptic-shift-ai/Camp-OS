import type { SupabaseClient, User } from '@supabase/supabase-js'
import { resolveUserPropertyAccess } from '@/lib/rbac/resolve-access'
import { canAccessOperationsModules, canAccessPropertySettings, canManageStaffRoster, canViewFinancials } from '@/lib/rbac/dashboard-guards'

export type DashboardNavVisibility = {
  /** Operations modules (reservations, sites, guests, auditing, analytics) */
  operationsModulesNavVisible: boolean
  /** Staff management page */
  staffManagementNavVisible: boolean
  /** Property settings page */
  propertySettingsNavVisible: boolean
  /** Financial pages (transactions, refunds, deposits) — NEW */
  financialNavVisible: boolean
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
    }
  }

  return {
    operationsModulesNavVisible: canAccessOperationsModules(access),
    staffManagementNavVisible: canManageStaffRoster(access),
    propertySettingsNavVisible: canAccessPropertySettings(access),
    financialNavVisible: canViewFinancials(access),
  }
}

export type DashboardUserLabels = {
  displayName: string
  roleLabel: string
}

export async function resolveDashboardUserLabels(
  supabase: SupabaseClient,
  user: User,
): Promise<DashboardUserLabels> {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
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

  const userType = typeof metadata.user_type === 'string' ? metadata.user_type : ''
  const roleLabel =
    ownerCompany?.id
      ? 'Owner'
      : userType.length > 0
        ? `${userType.charAt(0).toUpperCase()}${userType.slice(1)}`
        : 'Owner'

  return { displayName, roleLabel }
}

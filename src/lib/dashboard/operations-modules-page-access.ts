/**
 * @deprecated Use `canAccessOperationsModules()` from `@/lib/rbac/dashboard-guards` instead.
 * This file is kept for backward compatibility and delegates to the RBAC module.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { resolveDashboardAccess, canAccessOperationsModules } from '@/lib/rbac/dashboard-guards'

export async function userCanAccessOperationsDashboardModules(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const access = await resolveDashboardAccess(supabase, propertyId, userId)
  if (!access) return false
  return canAccessOperationsModules(access)
}

export async function redirectIfOperationsDashboardModulesForbidden(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
): Promise<void> {
  const access = await resolveDashboardAccess(supabase, propertyId, userId)
  if (!access || !canAccessOperationsModules(access)) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }
}

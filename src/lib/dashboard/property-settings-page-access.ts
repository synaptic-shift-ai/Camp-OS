/**
 * @deprecated Use `canAccessPropertySettings()` from `@/lib/rbac/dashboard-guards` instead.
 * This file is kept for backward compatibility and delegates to the RBAC module.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveDashboardAccess, canAccessPropertySettings } from '@/lib/rbac/dashboard-guards'

export async function userCanAccessPropertySettingsPage(
  supabase: SupabaseClient,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const access = await resolveDashboardAccess(supabase, propertyId, userId)
  if (!access) return false
  return canAccessPropertySettings(access)
}

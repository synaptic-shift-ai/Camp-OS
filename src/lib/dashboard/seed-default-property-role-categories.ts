import type { SupabaseClient } from '@supabase/supabase-js'
import { StaffManagementQueries, type UiRole } from '@/lib/dashboard/staff-management-queries'

/**
 * Default role category names per role for a new property.
 * Keep aligned with `INITIAL_CATEGORIES` in `staff-management-categories-dialog.tsx`.
 */
export const DEFAULT_ROLE_CATEGORY_NAMES: Record<
  Exclude<UiRole, 'owner'>,
  { name: string }[]
> = {
  admin: [{ name: 'Operations' }, { name: 'Finance' }, { name: 'Guest Services' }],
  manager: [{ name: 'Housekeeping' }, { name: 'Maintenance' }, { name: 'Front Desk' }],
  staff: [{ name: 'Housekeeping' }, { name: 'Maintenance' }, { name: 'Front Desk' }],
}

export function defaultRoleCategoriesByRolePayload(): Record<UiRole, { name: string }[]> {
  return {
    owner: [],
    admin: [...DEFAULT_ROLE_CATEGORY_NAMES.admin],
    manager: [...DEFAULT_ROLE_CATEGORY_NAMES.manager],
    staff: [...DEFAULT_ROLE_CATEGORY_NAMES.staff],
  }
}

/**
 * Inserts default `property_role_categories` when none exist for the property.
 * Skips if any row already exists (avoids deleting custom categories via savePropertyRolesCategories).
 */
export async function seedDefaultPropertyRoleCategoriesIfEmpty(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<{ seeded: boolean; savedCount?: number }> {
  const { count, error: countError } = await supabase
    .from('property_role_categories')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)

  if (countError) throw countError
  if ((count ?? 0) > 0) {
    return { seeded: false }
  }

  const queries = new StaffManagementQueries(supabase)
  const { savedCount } = await queries.savePropertyRolesCategories({
    propertyId,
    categoriesByRole: defaultRoleCategoriesByRolePayload(),
  })

  return { seeded: true, savedCount }
}

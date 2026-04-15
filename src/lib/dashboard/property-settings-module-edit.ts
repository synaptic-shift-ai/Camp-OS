import type { createClient } from '@/lib/supabase/server'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'

const SETTINGS_MODULE_KEY = 'settings' as const
const SETTINGS_ACTIONS = ['view', 'edit'] as const

function settingsModuleFallbackForCategory(
  role: 'owner' | 'admin' | 'manager' | 'staff',
  _categoryName: string,
): Record<string, boolean> {
  if (role === 'owner' || role === 'admin') return { view: true, edit: true }
  return { view: false, edit: false }
}

async function resolveSettingsModuleActions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<Record<string, boolean>> {
  return resolveModuleActionAccess({
    supabase,
    propertyId,
    userId,
    moduleKey: SETTINGS_MODULE_KEY,
    actions: SETTINGS_ACTIONS,
    fallbackForCategory: settingsModuleFallbackForCategory,
  })
}

/** Matches dashboard settings page `resolveModuleActionAccess` for `settings.view`. */
export async function canViewPropertySettingsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveSettingsModuleActions(supabase, propertyId, userId)
  return actions.view === true
}

/** Matches dashboard settings page `resolveModuleActionAccess` for `settings.edit`. */
export async function canEditPropertySettingsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveSettingsModuleActions(supabase, propertyId, userId)
  return actions.edit === true
}

export const PROPERTY_SETTINGS_EDIT_FORBIDDEN_MESSAGE =
  'You do not have permission to edit property settings.'

export const PROPERTY_SETTINGS_VIEW_FORBIDDEN_MESSAGE =
  'You do not have permission to view property settings.'

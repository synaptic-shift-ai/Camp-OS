import type { createClient } from '@/lib/supabase/server'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'

const GUESTS_MODULE_KEY = 'guests' as const
const GUESTS_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const

type UiRole = 'owner' | 'admin' | 'manager' | 'staff'

function guestsModuleFallbackForCategory(
  role: UiRole,
  categoryName: string,
): Record<string, boolean> {
  if (role === 'owner' || role === 'admin') {
    return {
      view: true,
      create: true,
      edit: true,
      delete: true,
      export: true,
    }
  }

  const normalized = categoryName.trim().toLowerCase()
  if ((role === 'manager' || role === 'staff') && normalized === 'front desk') {
    return {
      view: true,
      create: false,
      edit: false,
      delete: false,
      export: false,
    }
  }

  return {
    view: false,
    create: false,
    edit: false,
    delete: false,
    export: false,
  }
}

async function resolveGuestsModuleActions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<Record<string, boolean>> {
  return resolveModuleActionAccess({
    supabase,
    propertyId,
    userId,
    moduleKey: GUESTS_MODULE_KEY,
    actions: GUESTS_ACTIONS,
    fallbackForCategory: guestsModuleFallbackForCategory,
  })
}

export async function canEditGuestsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveGuestsModuleActions(supabase, propertyId, userId)
  return actions.edit === true
}

export async function canDeleteGuestsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveGuestsModuleActions(supabase, propertyId, userId)
  return actions.delete === true
}

export async function canExportGuestsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveGuestsModuleActions(supabase, propertyId, userId)
  return actions.export === true
}


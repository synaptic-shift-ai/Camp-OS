import type { createClient } from '@/lib/supabase/server'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'

const SITES_MODULE_KEY = 'sites' as const
const SITES_ACTIONS = ['view', 'create', 'edit', 'delete', 'pricing'] as const

type UiRole = 'owner' | 'admin' | 'manager' | 'staff'

function sitesModuleFallbackForCategory(
  role: UiRole,
  _categoryName: string,
): Record<string, boolean> {
  if (role === 'owner' || role === 'admin') {
    return {
      view: true,
      create: true,
      edit: true,
      delete: true,
      pricing: true,
    }
  }

  if (role === 'manager') {
    return {
      view: true,
      create: true,
      edit: true,
      delete: false,
      pricing: true,
    }
  }

  return {
    view: true,
    create: true,
    edit: true,
    delete: false,
    pricing: false,
  }
}

async function resolveSitesModuleActions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<Record<string, boolean>> {
  return resolveModuleActionAccess({
    supabase,
    propertyId,
    userId,
    moduleKey: SITES_MODULE_KEY,
    actions: SITES_ACTIONS,
    fallbackForCategory: sitesModuleFallbackForCategory,
  })
}

export async function canCreateSitesModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveSitesModuleActions(supabase, propertyId, userId)
  return actions.create === true
}

export async function canEditSitesModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveSitesModuleActions(supabase, propertyId, userId)
  return actions.edit === true
}

export async function canDeleteSitesModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveSitesModuleActions(supabase, propertyId, userId)
  return actions.delete === true
}


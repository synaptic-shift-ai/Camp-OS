import type { createClient } from '@/lib/supabase/server'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'

const RESERVATIONS_MODULE_KEY = 'reservations' as const
const RESERVATIONS_ACTIONS = [
  'view',
  'create',
  'modify',
  'check-in',
  'check-out',
  'cancel',
] as const

type UiRole = 'owner' | 'admin' | 'manager' | 'staff'

function reservationsModuleFallbackForCategory(
  role: UiRole,
  categoryName: string,
): Record<string, boolean> {
  if (role === 'owner' || role === 'admin') {
    return {
      view: true,
      create: true,
      modify: true,
      'check-in': true,
      'check-out': true,
      cancel: true,
    }
  }

  const category = categoryName.trim().toLowerCase()
  if (category === 'front desk') {
    return {
      view: true,
      create: false,
      modify: false,
      'check-in': true,
      'check-out': true,
      cancel: false,
    }
  }

  return {
    view: false,
    create: false,
    modify: false,
    'check-in': false,
    'check-out': false,
    cancel: false,
  }
}

async function resolveReservationsModuleActions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<Record<string, boolean>> {
  return resolveModuleActionAccess({
    supabase,
    propertyId,
    userId,
    moduleKey: RESERVATIONS_MODULE_KEY,
    actions: RESERVATIONS_ACTIONS,
    fallbackForCategory: reservationsModuleFallbackForCategory,
  })
}

export async function canCheckInReservationsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveReservationsModuleActions(supabase, propertyId, userId)
  return actions['check-in'] === true
}

export async function canCheckOutReservationsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveReservationsModuleActions(supabase, propertyId, userId)
  return actions['check-out'] === true
}

export async function canCancelReservationsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveReservationsModuleActions(supabase, propertyId, userId)
  return actions.cancel === true
}

export async function canCreateReservationsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveReservationsModuleActions(supabase, propertyId, userId)
  return actions.create === true
}

export async function canModifyReservationsModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const actions = await resolveReservationsModuleActions(supabase, propertyId, userId)
  return actions.modify === true
}


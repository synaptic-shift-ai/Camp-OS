import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'
import { UpdateMaintenanceGuideSchema } from '@/types/api/v1/schemas/maintenance'

function maintenanceFallbackForCategory(
  role: 'owner' | 'admin' | 'manager' | 'staff',
  categoryName: string,
): Record<string, boolean> {
  if (role === 'owner' || role === 'admin') return { view: true, create: true, update: true, delete: true }
  const category = categoryName.trim().toLowerCase()
  if (role === 'manager' && category === 'maintenance') {
    return { view: true, create: true, update: true, delete: true }
  }
  if (role === 'staff' && category === 'maintenance') {
    return { view: true, create: false, update: false, delete: false }
  }
  return { view: false, create: false, update: false, delete: false }
}

/**
 * GET /api/v1/properties/[propertyId]/maintenance/guides/[guideId]
 *
 * Get a single maintenance guide.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; guideId: string }> },
) {
  try {
    const { propertyId, guideId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      permission: 'maintenance.view_assigned',
    })
    if (isDenied(access)) return access

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const guide = await queries.getMaintenanceGuideById(guideId)

    if (!guide) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Maintenance guide not found' })
    }

    return success({ guide }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Maintenance guides API v1] GET [guideId] error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * PATCH /api/v1/properties/[propertyId]/maintenance/guides/[guideId]
 *
 * Update a maintenance guide.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; guideId: string }> },
) {
  try {
    const { propertyId, guideId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      permission: 'maintenance.update_assigned',
    })
    if (isDenied(access)) return access

    const actionAccess = await resolveModuleActionAccess({
      supabase: supabase as SupabaseClient,
      propertyId,
      userId: user.id,
      moduleKey: 'maintenance',
      actions: ['update'],
      fallbackForCategory: maintenanceFallbackForCategory,
    })
    if (!actionAccess.update) {
      return error(
        ErrorCodes.AUTH_002.code,
        'You do not have permission to edit maintenance guides.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const body = await request.json()
    const parsed = UpdateMaintenanceGuideSchema.safeParse(body)

    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const guide = await queries.updateMaintenanceGuide({
      id: guideId,
      propertyId,
      createdBy: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      steps: parsed.data.steps.map((step) => ({
        id: step.id,
        label: step.label,
        ...(step.notes ? { notes: step.notes } : {}),
      })),
    })

    if (access.companyId) {
      const service = createServiceRoleClient()
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'update',
          resource: 'maintenance',
          userId: user.id,
          details: `Updated maintenance guide "${guide.name}".`,
        },
        { failOpen: false },
      )
    }

    return success({ guide }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Maintenance guides API v1] PATCH error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * DELETE /api/v1/properties/[propertyId]/maintenance/guides/[guideId]
 *
 * Delete a maintenance guide.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; guideId: string }> },
) {
  try {
    const { propertyId, guideId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      permission: 'maintenance.assign_wo',
    })
    if (isDenied(access)) return access

    const actionAccess = await resolveModuleActionAccess({
      supabase: supabase as SupabaseClient,
      propertyId,
      userId: user.id,
      moduleKey: 'maintenance',
      actions: ['delete'],
      fallbackForCategory: maintenanceFallbackForCategory,
    })
    if (!actionAccess.delete) {
      return error(
        ErrorCodes.AUTH_002.code,
        'You do not have permission to delete maintenance guides.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const { data: existing } = await supabase
      .from('maintenance_guides')
      .select('name')
      .eq('id', guideId)
      .eq('property_id', propertyId)
      .maybeSingle()

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    await queries.deleteMaintenanceGuide({ id: guideId, propertyId })

    if (access.companyId) {
      const service = createServiceRoleClient()
      const label = existing?.name ?? guideId
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'delete',
          resource: 'maintenance',
          userId: user.id,
          details: `Deleted maintenance guide "${label}".`,
        },
        { failOpen: false },
      )
    }

    return success({ deleted: true }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Maintenance guides API v1] DELETE error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

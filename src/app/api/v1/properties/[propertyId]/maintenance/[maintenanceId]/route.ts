import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'
import { UpdateMaintenanceTaskRequestSchema } from '@/types/api/v1/schemas/maintenance'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; maintenanceId: string }> },
) {
  try {
    const { propertyId, maintenanceId } = await params
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
      supabase: supabase as any,
      propertyId,
      userId: user.id,
      moduleKey: 'maintenance',
      actions: ['update'],
      fallbackForCategory: maintenanceFallbackForCategory,
    })
    if (!actionAccess.update) {
      return error(
        ErrorCodes.AUTH_002.code,
        'You do not have permission to edit maintenance tasks.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const body = await request.json()
    const parsed = UpdateMaintenanceTaskRequestSchema.safeParse(body)

    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const maintenanceTask = await queries.updateMaintenanceTask({
      id: maintenanceId,
      propertyId,
      ...(parsed.data.siteId !== undefined ? { siteId: parsed.data.siteId } : {}),
      ...(parsed.data.staffId !== undefined ? { staffId: parsed.data.staffId } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    })

    if (access.companyId) {
      const { data: siteRow } = await supabase
        .from('sites')
        .select('site_name, site_number')
        .eq('id', maintenanceTask.site_id)
        .eq('property_id', propertyId)
        .maybeSingle()
      const auditSiteLabel = siteRow?.site_name?.trim() || siteRow?.site_number || maintenanceTask.site_id
      const service = createServiceRoleClient()
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'update',
          resource: 'maintenance',
          userId: user.id,
          details: `Updated maintenance task "${maintenanceTask.title}" for site ${auditSiteLabel}.`,
        },
        { failOpen: false },
      )
    }

    return success({ maintenanceTask }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Maintenance API v1] PATCH error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; maintenanceId: string }> },
) {
  try {
    const { propertyId, maintenanceId } = await params
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
      supabase: supabase as any,
      propertyId,
      userId: user.id,
      moduleKey: 'maintenance',
      actions: ['delete'],
      fallbackForCategory: maintenanceFallbackForCategory,
    })
    if (!actionAccess.delete) {
      return error(
        ErrorCodes.AUTH_002.code,
        'You do not have permission to delete maintenance tasks.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const { data: existingTask } = await supabase
      .from('maintenance_tasks')
      .select('title, site_id')
      .eq('id', maintenanceId)
      .eq('property_id', propertyId)
      .maybeSingle()

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    await queries.deleteMaintenanceTask({ id: maintenanceId, propertyId })

    if (access.companyId) {
      let auditSiteLabel = existingTask?.site_id ?? 'unknown site'
      if (existingTask?.site_id) {
        const { data: siteRow } = await supabase
          .from('sites')
          .select('site_name, site_number')
          .eq('id', existingTask.site_id)
          .eq('property_id', propertyId)
          .maybeSingle()
        auditSiteLabel = siteRow?.site_name?.trim() || siteRow?.site_number || existingTask.site_id
      }

      const deletedTaskLabel = existingTask?.title ?? maintenanceId
      const service = createServiceRoleClient()
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'delete',
          resource: 'maintenance',
          userId: user.id,
          details: `Deleted maintenance task "${deletedTaskLabel}" for site ${auditSiteLabel}.`,
        },
        { failOpen: false },
      )
    }

    return success({ deleted: true }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Maintenance API v1] DELETE error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

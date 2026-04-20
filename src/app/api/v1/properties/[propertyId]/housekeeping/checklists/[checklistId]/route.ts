import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { HousekeepingQueries } from '@/lib/dashboard/housekeeping/housekeeping-queries'
import { UpdateChecklistRequestSchema } from '@/types/api/v1/schemas/housekeeping'

function housekeepingFallbackForCategory(
  role: 'owner' | 'admin' | 'manager' | 'staff',
  categoryName: string,
): Record<string, boolean> {
  if (role === 'owner' || role === 'admin') return { view: true, create: true, update: true, delete: true }
  const category = categoryName.trim().toLowerCase()
  if (role === 'manager' && category === 'housekeeping') {
    return { view: true, create: true, update: true, delete: true }
  }
  if (role === 'staff' && category === 'housekeeping') {
    return { view: true, create: false, update: false, delete: false }
  }
  return { view: false, create: false, update: false, delete: false }
}

/**
 * PATCH /api/v1/properties/[propertyId]/housekeeping/checklists/[checklistId]
 *
 * Update a checklist template for the property.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; checklistId: string }> },
) {
  try {
    const { propertyId, checklistId } = await params
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
      permission: 'housekeeping.start_complete',
    })
    if (isDenied(access)) return access

    const actionAccess = await resolveModuleActionAccess({
      supabase: supabase as SupabaseClient,
      propertyId,
      userId: user.id,
      moduleKey: 'housekeeping',
      actions: ['update'],
      fallbackForCategory: housekeepingFallbackForCategory,
    })
    if (!actionAccess.update) {
      return error(
        ErrorCodes.AUTH_002.code,
        'You do not have permission to edit housekeeping checklists.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const body = await request.json()
    const parsed = UpdateChecklistRequestSchema.safeParse(body)

    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const checklist = await queries.updatePropertyChecklist({
      id: checklistId,
      propertyId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      items: parsed.data.items.map((row) => ({
        id: row.id,
        label: row.label,
        notes: row.notes ?? null,
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
          resource: 'housekeeping',
          userId: user.id,
          details: `Updated checklist template "${checklist.name}".`,
        },
        { failOpen: false },
      )
    }

    return success({ checklist }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Housekeeping checklists API v1] PATCH error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * DELETE /api/v1/properties/[propertyId]/housekeeping/checklists/[checklistId]
 *
 * Delete a checklist template for the property.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; checklistId: string }> },
) {
  try {
    const { propertyId, checklistId } = await params
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
      permission: 'housekeeping.reassign',
    })
    if (isDenied(access)) return access

    const actionAccess = await resolveModuleActionAccess({
      supabase: supabase as SupabaseClient,
      propertyId,
      userId: user.id,
      moduleKey: 'housekeeping',
      actions: ['delete'],
      fallbackForCategory: housekeepingFallbackForCategory,
    })
    if (!actionAccess.delete) {
      return error(
        ErrorCodes.AUTH_002.code,
        'You do not have permission to delete housekeeping checklists.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const { data: existing } = await supabase
      .from('checklist')
      .select('name')
      .eq('id', checklistId)
      .eq('property_id', propertyId)
      .maybeSingle()

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    await queries.deletePropertyChecklist({ id: checklistId, propertyId })

    if (access.companyId) {
      const service = createServiceRoleClient()
      const label = existing?.name ?? checklistId
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'delete',
          resource: 'housekeeping',
          userId: user.id,
          details: `Deleted checklist template "${label}".`,
        },
        { failOpen: false },
      )
    }

    return success({ deleted: true }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Housekeeping checklists API v1] DELETE error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

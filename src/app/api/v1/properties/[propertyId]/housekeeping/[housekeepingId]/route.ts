import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { HousekeepingQueries } from '@/lib/dashboard/housekeeping/housekeeping-queries'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'
import { UpdateHousekeepingTaskRequestSchema } from '@/types/api/v1/schemas/housekeeping'

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
 * PATCH /api/v1/properties/[propertyId]/housekeeping/[housekeepingId]
 *
 * Update a housekeeping task for the property.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; housekeepingId: string }> },
) {
  try {
    const { propertyId, housekeepingId } = await params
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
      supabase: supabase as any,
      propertyId,
      userId: user.id,
      moduleKey: 'housekeeping',
      actions: ['update'],
      fallbackForCategory: housekeepingFallbackForCategory,
    })
    if (!actionAccess.update) {
      return error(
        ErrorCodes.AUTH_002.code,
        'You do not have permission to edit housekeeping tasks.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const body = await request.json()
    const parsed = UpdateHousekeepingTaskRequestSchema.safeParse(body)

    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    let reservationId: string | null | undefined = undefined
    if (parsed.data.reservationConfirmationId !== undefined) {
      if (!parsed.data.reservationConfirmationId) {
        reservationId = null
      } else {
        const { data: reservationRow, error: reservationError } = await supabase
          .from('reservations')
          .select('id')
          .eq('property_id', propertyId)
          .eq('confirmation_number', parsed.data.reservationConfirmationId)
          .maybeSingle()
        if (reservationError) {
          throw new Error(`Failed to validate reservation confirmation id: ${reservationError.message}`)
        }
        if (!reservationRow) {
          throw new Error('Reservation confirmation id was not found for this property.')
        }
        reservationId = reservationRow.id
      }
    }

    if (parsed.data.checklistTemplateId) {
      const { data: checklistRow, error: checklistError } = await supabase
        .from('checklist')
        .select('id')
        .eq('property_id', propertyId)
        .eq('id', parsed.data.checklistTemplateId)
        .maybeSingle()
      if (checklistError) {
        throw new Error(`Failed to validate checklist template: ${checklistError.message}`)
      }
      if (!checklistRow) {
        throw new Error('Checklist template was not found for this property.')
      }
    }

    const toIsoOrNull = (value: string | undefined): string | null => {
      if (!value) return null
      const parsedDate = new Date(value)
      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error(`Invalid date/time value: ${value}`)
      }
      return parsedDate.toISOString()
    }

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const housekeepingTask = await queries.updateHousekeepingTask({
      id: housekeepingId,
      propertyId,
      ...(parsed.data.siteId !== undefined ? { siteId: parsed.data.siteId } : {}),
      ...(parsed.data.staffId !== undefined ? { staffId: parsed.data.staffId } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(reservationId !== undefined ? { reservationId } : {}),
      ...(parsed.data.checklistTemplateId !== undefined ? { checklistId: parsed.data.checklistTemplateId } : {}),
      ...(parsed.data.startDate !== undefined ? { startDate: toIsoOrNull(parsed.data.startDate) } : {}),
      ...(parsed.data.dueDate !== undefined ? { endDate: toIsoOrNull(parsed.data.dueDate) } : {}),
      ...(parsed.data.checklistItemDone !== undefined
        ? { checklistItemDone: parsed.data.checklistItemDone }
        : {}),
    })

    if (access.companyId) {
      const { data: siteRow } = await supabase
        .from('sites')
        .select('site_name, site_number')
        .eq('id', housekeepingTask.site_id)
        .eq('property_id', propertyId)
        .maybeSingle()
      const auditSiteLabel = siteRow?.site_name?.trim() || siteRow?.site_number || housekeepingTask.site_id
      const service = createServiceRoleClient()
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'update',
          resource: 'housekeeping',
          userId: user.id,
          details: `Updated housekeeping task "${housekeepingTask.title}" for site ${auditSiteLabel}.`,
        },
        { failOpen: false },
      )
    }

    return success({ housekeepingTask }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Housekeeping API v1] PATCH error:', err)
    if (
      message === 'Reservation confirmation id was not found for this property.' ||
      message === 'Checklist template was not found for this property.' ||
      message.startsWith('Invalid date/time value:')
    ) {
      return error(ErrorCodes.VALIDATION_ERROR, request, { message })
    }
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * DELETE /api/v1/properties/[propertyId]/housekeeping/[housekeepingId]
 *
 * Delete a housekeeping task for the property.
 */

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ propertyId: string; housekeepingId: string }> }
) {
    try {
        const { propertyId, housekeepingId } = await params
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
          supabase: supabase as any,
          propertyId,
          userId: user.id,
          moduleKey: 'housekeeping',
          actions: ['delete'],
          fallbackForCategory: housekeepingFallbackForCategory,
        })
        if (!actionAccess.delete) {
          return error(
            ErrorCodes.AUTH_002.code,
            'You do not have permission to delete housekeeping tasks.',
            ErrorCodes.AUTH_002.status,
            request,
          )
        }

        const { data: existingTask } = await supabase
          .from('housekeeping_tasks')
          .select('title, site_id')
          .eq('id', housekeepingId)
          .eq('property_id', propertyId)
          .maybeSingle()

        const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
        await queries.deleteHousekeepingTask({ id: housekeepingId, propertyId })

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

          const deletedTaskLabel = existingTask?.title ?? housekeepingId
          const service = createServiceRoleClient()
          await recordActivityLog(
            service,
            {
              companyId: access.companyId,
              propertyId,
              action: 'delete',
              resource: 'housekeeping',
              userId: user.id,
              details: `Deleted housekeeping task "${deletedTaskLabel}" for site ${auditSiteLabel}.`,
            },
            { failOpen: false },
          )
        }

        return success({ deleted: true }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Housekeeping API v1] DELETE error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}
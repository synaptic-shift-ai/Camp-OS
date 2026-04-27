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
import { maintenanceFallbackForCategory } from '@/lib/dashboard/maintenance-module-access'
import { UpdateMaintenanceTaskRequestSchema } from '@/types/api/v1/schemas/maintenance'
import { getEventBus } from '@/shared/infrastructure/eventBus'
import { MaintenanceTaskCompletedEvent } from '@/modules/Maintenance/domain/events'

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  in_progress_vendor: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: ['open'],
  cancelled: ['open'],
}

export async function GET(
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
      permission: 'maintenance.view_assigned',
    })
    if (isDenied(access)) return access

    const { data: task, error: fetchError } = await supabase
      .from('maintenance_tasks')
      .select(
        `*,
         site:sites(site_name, site_number, site_type)`,
      )
      .eq('id', maintenanceId)
      .eq('property_id', propertyId)
      .maybeSingle()

    if (fetchError || !task) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Maintenance task not found.' })
    }

    return success({ maintenanceTask: task }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Maintenance API v1] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
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
      actions: ['update', 'assign-wo', 'enter-labor-cost', 'request-onhold', 'approve-onhold', 'cancel-wo'],
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

    const canAssignWorkOrder = actionAccess['assign-wo'] === true

    // Completion lock: prevent cost changes on completed work orders
    const { data: currentTask } = await supabase
      .from('maintenance_tasks')
      .select('status, started_at, on_hold_at, sla')
      .eq('id', maintenanceId)
      .eq('property_id', propertyId)
      .maybeSingle()

    const isCompleted = currentTask?.status === 'completed'
    const hasCostFields =
      (parsed.data.estimatedLaborCost != null && parsed.data.estimatedLaborCost !== undefined) ||
      (parsed.data.estimatedPartsCost != null && parsed.data.estimatedPartsCost !== undefined)

    if (isCompleted && hasCostFields) {
      return error(
        ErrorCodes.VALIDATION_ERROR,
        request,
        { message: 'Cost fields cannot be modified on completed work orders' },
      )
    }

    // Permission strip: silently remove cost fields if user lacks enter-labor-cost
    if (!actionAccess['enter-labor-cost']) {
      delete parsed.data.estimatedLaborCost
      delete parsed.data.estimatedPartsCost
    }

    // ── State machine validation ──
    const currentStatus = currentTask?.status ?? 'open'
    const requestedStatus = parsed.data.status

    if (requestedStatus && currentStatus !== requestedStatus) {
      const allowed = VALID_TRANSITIONS[currentStatus]
      if (!allowed?.includes(requestedStatus)) {
        return error(
          ErrorCodes.VALIDATION_ERROR,
          request,
          { message: `Invalid status transition: ${currentStatus} → ${requestedStatus}` },
        )
      }

      // Permission gating for protected transitions
      if (requestedStatus === 'on_hold') {
        if (!actionAccess['request-onhold']) {
          return error(
            ErrorCodes.AUTH_002.code,
            'You do not have permission to put work orders on hold',
            ErrorCodes.AUTH_002.status,
            request,
          )
        }
      }
      if (requestedStatus === 'in_progress' && currentStatus === 'on_hold') {
        if (!actionAccess['approve-onhold']) {
          return error(
            ErrorCodes.AUTH_002.code,
            'You do not have permission to resume work orders on hold',
            ErrorCodes.AUTH_002.status,
            request,
          )
        }
      }
      if (requestedStatus === 'cancelled') {
        if (!actionAccess['cancel-wo']) {
          return error(
            ErrorCodes.AUTH_002.code,
            'You do not have permission to cancel work orders',
            ErrorCodes.AUTH_002.status,
            request,
          )
        }
      }
    }

    // SLA guard: prevent open → in_progress without SLA
    if (requestedStatus === 'in_progress' && currentStatus === 'open' && !currentTask?.sla) {
      return error(
        ErrorCodes.VALIDATION_ERROR,
        request,
        { message: 'Cannot start work — SLA must be set before beginning work on this order.' },
      )
    }

    // ── Timestamp management ──
    const timestampUpdates: Record<string, any> = {}

    if (requestedStatus && currentStatus !== requestedStatus) {
      switch (requestedStatus) {
        case 'in_progress':
          if (currentStatus === 'open') {
            timestampUpdates.started_at = new Date().toISOString()
          }
          // Resume from hold: clear hold fields
          if (currentStatus === 'on_hold') {
            // Shift started_at forward by hold duration so work timer excludes paused time.
            const startedAtMs = currentTask?.started_at ? new Date(currentTask.started_at).getTime() : null
            const holdAtMs = currentTask?.on_hold_at ? new Date(currentTask.on_hold_at).getTime() : null
            if (startedAtMs && holdAtMs && holdAtMs > startedAtMs) {
              const holdDurationMs = Date.now() - holdAtMs
              timestampUpdates.started_at = new Date(startedAtMs + holdDurationMs).toISOString()
            } else {
              timestampUpdates.started_at = currentTask?.started_at || new Date().toISOString()
            }
            timestampUpdates.on_hold_at = null
            timestampUpdates.on_hold_reason = null
          }
          break
        case 'completed':
          timestampUpdates.completed_at = new Date().toISOString()
          break
        case 'on_hold':
          if (!parsed.data.on_hold_reason) {
            return error(
              ErrorCodes.VALIDATION_ERROR,
              request,
              { message: 'on_hold_reason is required when putting a work order on hold' },
            )
          }
          timestampUpdates.on_hold_at = new Date().toISOString()
          timestampUpdates.on_hold_reason = parsed.data.on_hold_reason
          break
        case 'cancelled':
          if (!parsed.data.cancelled_reason) {
            return error(
              ErrorCodes.VALIDATION_ERROR,
              request,
              { message: 'cancelled_reason is required when cancelling a work order' },
            )
          }
          timestampUpdates.cancelled_at = new Date().toISOString()
          timestampUpdates.cancelled_reason = parsed.data.cancelled_reason
          break
        case 'open':
          // Reopen: clear previous lifecycle timestamps
          if (currentStatus === 'completed') {
            timestampUpdates.completed_at = null
          }
          if (currentStatus === 'cancelled') {
            timestampUpdates.cancelled_at = null
            timestampUpdates.cancelled_reason = null
          }
          break
      }
    }

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
    const maintenanceTask = await queries.updateMaintenanceTask({
      id: maintenanceId,
      propertyId,
      ...(parsed.data.siteId !== undefined ? { siteId: parsed.data.siteId } : {}),
      ...(parsed.data.staffId !== undefined && canAssignWorkOrder ? { staffId: parsed.data.staffId } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.source !== undefined ? { source: parsed.data.source } : {}),
      ...(parsed.data.estimatedLaborCost !== undefined ? { estimatedLaborCost: parsed.data.estimatedLaborCost } : {}),
      ...(parsed.data.estimatedPartsCost !== undefined ? { estimatedPartsCost: parsed.data.estimatedPartsCost } : {}),
      ...(parsed.data.actualLaborCost !== undefined ? { actualLaborCost: parsed.data.actualLaborCost } : {}),
      ...(parsed.data.actualPartsCost !== undefined ? { actualPartsCost: parsed.data.actualPartsCost } : {}),
      ...(parsed.data.isSuspectedDamage !== undefined ? { isSuspectedDamage: parsed.data.isSuspectedDamage } : {}),
      ...(parsed.data.vendorId !== undefined ? { vendorId: parsed.data.vendorId } : {}),
      ...(parsed.data.sla !== undefined ? { sla: parsed.data.sla } : {}),
      ...timestampUpdates,
    })

    // Completion-triggered PM auto-generation
    if (maintenanceTask.status === 'completed') {
      const scheduleId = (maintenanceTask as any).schedule_id
      if (scheduleId) {
        try {
          await queries.generateNextWorkOrder(scheduleId, new Date())
        } catch {
          // Silently fail — don't block completion
        }
      }

      // Publish domain event (fire-and-forget)
      try {
        const eventBus = getEventBus()
        const task = maintenanceTask as any
        await eventBus.publish(new MaintenanceTaskCompletedEvent(
          propertyId,
          maintenanceId,
          task.wo_number ?? '',
          task.category ?? '',
          Number(task.actual_labor_cost ?? 0),
          Number(task.actual_parts_cost ?? 0),
        ))
      } catch {
        // Non-blocking: event publishing failures should not prevent completion
      }
    }

    // Status-change activity log
    if (access.companyId && requestedStatus && currentStatus !== requestedStatus) {
      const fromLabel = currentStatus.replace(/_/g, ' ')
      const toLabel = requestedStatus.replace(/_/g, ' ')
      let logDetail = `Status changed from ${fromLabel} to ${toLabel} by ${user.email || 'Unknown'}`
      if (parsed.data.on_hold_reason) {
        logDetail += `. Reason: ${parsed.data.on_hold_reason}`
      }
      if (parsed.data.cancelled_reason) {
        logDetail += `. Reason: ${parsed.data.cancelled_reason}`
      }
      const statusLogService = createServiceRoleClient()
      await recordActivityLog(
        statusLogService,
        {
          companyId: access.companyId,
          propertyId,
          action: 'status_change',
          resource: 'maintenance',
          userId: user.id,
          details: logDetail,
        },
        { failOpen: false },
      )
    }

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
    if (message === 'Vendor not found for this property') {
      return error(ErrorCodes.VALIDATION_ERROR, request, { message })
    }
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

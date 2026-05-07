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
import { computeResumedMaintenanceStartedAtMs } from '@/lib/dashboard/maintenance/compute-resumed-maintenance-started-at'
import { MaintenanceTaskCompletedEvent } from '@/modules/Maintenance/domain/events'
import { buildEventContext } from '@/lib/automations/event-context'
import { runPipelineForTrigger } from '@/lib/automations/run-pipeline'

function toCanonicalSiteTypeKey(siteType: string | null | undefined): string {
  return (siteType ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bsite\b/g, '')
    .trim()
}

type MaintenancePatchLogContext = {
  propertyId: string
  maintenanceId: string
  userId?: string
}

function logMaintenancePatchValidationFailure(
  request: NextRequest,
  ctx: MaintenancePatchLogContext,
  reason: string,
  details?: Record<string, unknown>,
) {
  console.warn('[Maintenance API v1] PATCH validation rejected', {
    reason,
    requestId: request.headers.get('x-request-id') ?? undefined,
    ...ctx,
    ...details,
  })
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'in_progress_vendor', 'cancelled'],
  in_progress: ['in_progress_vendor', 'on_hold', 'completed', 'cancelled'],
  in_progress_vendor: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'in_progress_vendor', 'cancelled'],
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
         site:sites(site_name, site_number, site_type),
         vendor:property_vendor(name, phone, email, service_type)`,
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
  const { propertyId, maintenanceId } = await params
  try {
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
    const patchLogCtx: MaintenancePatchLogContext = {
      propertyId,
      maintenanceId,
      userId: user.id,
    }
    const body = await request.json()
    const parsed = UpdateMaintenanceTaskRequestSchema.safeParse(body)

    if (!parsed.success) {
      logMaintenancePatchValidationFailure(request, patchLogCtx, 'Request body failed schema validation', {
        issues: parsed.error.issues,
      })
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    if (parsed.data.scheduledStart && parsed.data.dueDate) {
      const startMs = new Date(parsed.data.scheduledStart).getTime()
      const endMs = new Date(parsed.data.dueDate).getTime()
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs < startMs) {
        logMaintenancePatchValidationFailure(request, patchLogCtx, 'Due date before scheduled start', {
          scheduledStart: parsed.data.scheduledStart,
          dueDate: parsed.data.dueDate,
        })
        return error(ErrorCodes.VALIDATION_ERROR, request, {
          message: 'Due date must be the same as or after the scheduled start.',
        })
      }
    }

    const canAssignWorkOrder = actionAccess['assign-wo'] === true
    const canRequestOnHold = actionAccess['request-onhold'] === true || actionAccess.update === true
    const canApproveOnHold = actionAccess['approve-onhold'] === true

    // Completion lock: prevent cost changes on completed work orders
    const { data: currentTask } = await supabase
      .from('maintenance_tasks')
      .select(
        'status, started_at, on_hold_at, on_hold_reason, sla, vendor_id, category, estimated_labor_cost, estimated_parts_cost, scheduled_start, due_date, site_id',
      )
      .eq('id', maintenanceId)
      .eq('property_id', propertyId)
      .maybeSingle()

    const isCompleted = currentTask?.status === 'completed'
    const hasCostFields =
      (parsed.data.estimatedLaborCost != null && parsed.data.estimatedLaborCost !== undefined) ||
      (parsed.data.estimatedPartsCost != null && parsed.data.estimatedPartsCost !== undefined)

    if (isCompleted && hasCostFields) {
      logMaintenancePatchValidationFailure(
        request,
        patchLogCtx,
        'Cost fields cannot be modified on completed work orders',
        { currentStatus: currentTask?.status },
      )
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
    const effectiveRequestedStatus =
      requestedStatus === 'in_progress' &&
      currentStatus === 'on_hold' &&
      Boolean(currentTask?.vendor_id)
        ? 'in_progress_vendor'
        : requestedStatus
    const isStatusTransition = Boolean(effectiveRequestedStatus && currentStatus !== effectiveRequestedStatus)

    // On-hold request flow: staff can request hold by submitting reason only.
    if (!isStatusTransition && parsed.data.on_hold_reason !== undefined) {
      if (!canRequestOnHold) {
        return error(
          ErrorCodes.AUTH_002.code,
          'You do not have permission to request on-hold for work orders',
          ErrorCodes.AUTH_002.status,
          request,
        )
      }

      if (!['in_progress', 'in_progress_vendor'].includes(currentStatus)) {
        logMaintenancePatchValidationFailure(
          request,
          patchLogCtx,
          'On-hold requests can only be submitted for in-progress work orders',
          { currentStatus },
        )
        return error(
          ErrorCodes.VALIDATION_ERROR,
          request,
          { message: 'On-hold requests can only be submitted for in-progress work orders' },
        )
      }

      const trimmedReason = parsed.data.on_hold_reason?.trim()
      if (!trimmedReason) {
        logMaintenancePatchValidationFailure(
          request,
          patchLogCtx,
          'on_hold_reason is required when requesting an on-hold',
          { currentStatus },
        )
        return error(
          ErrorCodes.VALIDATION_ERROR,
          request,
          { message: 'on_hold_reason is required when requesting an on-hold' },
        )
      }
    }

    if (effectiveRequestedStatus && currentStatus !== effectiveRequestedStatus) {
      const allowed = VALID_TRANSITIONS[currentStatus]
      if (!allowed?.includes(effectiveRequestedStatus)) {
        logMaintenancePatchValidationFailure(
          request,
          patchLogCtx,
          'Invalid status transition',
          {
            currentStatus,
            effectiveRequestedStatus,
            allowedTransitions: allowed ?? null,
          },
        )
        return error(
          ErrorCodes.VALIDATION_ERROR,
          request,
          { message: `Invalid status transition: ${currentStatus} → ${effectiveRequestedStatus}` },
        )
      }

      // Permission gating for protected transitions
      if (effectiveRequestedStatus === 'on_hold') {
        if (!canApproveOnHold) {
          return error(
            ErrorCodes.AUTH_002.code,
            'You do not have permission to approve on-hold requests',
            ErrorCodes.AUTH_002.status,
            request,
          )
        }
      }
      if (
        (effectiveRequestedStatus === 'in_progress' || effectiveRequestedStatus === 'in_progress_vendor') &&
        currentStatus === 'on_hold'
      ) {
        if (!actionAccess['approve-onhold']) {
          return error(
            ErrorCodes.AUTH_002.code,
            'You do not have permission to resume work orders on hold',
            ErrorCodes.AUTH_002.status,
            request,
          )
        }
      }
      if (effectiveRequestedStatus === 'cancelled') {
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

    // SLA guard: prevent open → in_progress / in_progress_vendor without SLA
    if (
      (effectiveRequestedStatus === 'in_progress' || effectiveRequestedStatus === 'in_progress_vendor') &&
      currentStatus === 'open' &&
      !currentTask?.sla && !currentTask?.due_date
    ) {
      logMaintenancePatchValidationFailure(
        request,
        patchLogCtx,
        'Cannot start work without due date or SLA on open work order',
        {
          effectiveRequestedStatus,
          currentStatus,
          hasSla: Boolean(currentTask?.sla),
          hasDueDate: Boolean(currentTask?.due_date),
        },
      )
      return error(
        ErrorCodes.VALIDATION_ERROR,
        request,
        { message: 'Cannot start work — a due date or SLA must be set before beginning work on this order.' },
      )
    }

    // ── Timestamp management ──
    const timestampUpdates: Record<string, any> = {}

    if (effectiveRequestedStatus && currentStatus !== effectiveRequestedStatus) {
      switch (effectiveRequestedStatus) {
        case 'in_progress':
        case 'in_progress_vendor':
          if (currentStatus === 'open') {
            timestampUpdates.started_at = new Date().toISOString()
          }
          // Resume from hold: clear hold fields
          if (currentStatus === 'on_hold') {
            const startedAtMs = currentTask?.started_at ? new Date(currentTask.started_at).getTime() : null
            const holdAtMs = currentTask?.on_hold_at ? new Date(currentTask.on_hold_at).getTime() : null
            if (startedAtMs && holdAtMs && holdAtMs > startedAtMs) {
              const serverMs = Date.now()
              const parsedResumeAt = parsed.data.resumeAt ? new Date(parsed.data.resumeAt).getTime() : NaN
              const resumeAtMs =
                Number.isFinite(parsedResumeAt) && Math.abs(parsedResumeAt - serverMs) <= 5 * 60 * 1000
                  ? parsedResumeAt
                  : serverMs
              const nextStartedMs = computeResumedMaintenanceStartedAtMs({
                startedAtMs,
                holdAtMs,
                resumeAtMs,
              })
              timestampUpdates.started_at = new Date(nextStartedMs).toISOString()
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
        case 'on_hold': {
          if (!parsed.data.on_hold_reason && !currentTask?.on_hold_reason) {
            logMaintenancePatchValidationFailure(
              request,
              patchLogCtx,
              'on_hold_reason is required before approving on-hold',
              { currentStatus },
            )
            return error(
              ErrorCodes.VALIDATION_ERROR,
              request,
              { message: 'on_hold_reason is required before approving on-hold' },
            )
          }
          timestampUpdates.on_hold_reason = parsed.data.on_hold_reason ?? currentTask?.on_hold_reason ?? null
          const serverMs = Date.now()
          const startedAtMs = currentTask?.started_at ? new Date(currentTask.started_at).getTime() : null
          let onHoldAtMs = serverMs
          if (parsed.data.holdAt) {
            const clientHoldMs = new Date(parsed.data.holdAt).getTime()
            if (Number.isFinite(clientHoldMs)) {
              const withinSkewWindow = Math.abs(clientHoldMs - serverMs) <= 5 * 60 * 1000
              const onOrAfterStart = startedAtMs == null || clientHoldMs >= startedAtMs
              if (withinSkewWindow && onOrAfterStart) {
                onHoldAtMs = clientHoldMs
              }
            }
          }
          timestampUpdates.on_hold_at = new Date(onHoldAtMs).toISOString()
          break
        }
        case 'cancelled':
          if (!parsed.data.cancelled_reason) {
            logMaintenancePatchValidationFailure(
              request,
              patchLogCtx,
              'cancelled_reason is required when cancelling a work order',
              { currentStatus },
            )
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

    // Request-only update (no status transition): capture pending on-hold reason.
    if (!isStatusTransition && parsed.data.on_hold_reason !== undefined) {
      timestampUpdates.on_hold_reason = parsed.data.on_hold_reason?.trim() ?? null
      timestampUpdates.on_hold_at = null
    }

    if (parsed.data.siteId) {
      const { data: siteRow } = await supabase
        .from('sites')
        .select('id, site_type')
        .eq('id', parsed.data.siteId)
        .eq('property_id', propertyId)
        .is('deleted_at', null)
        .maybeSingle()

      if (!siteRow) {
        logMaintenancePatchValidationFailure(request, patchLogCtx, 'Site not found for this property', {
          siteId: parsed.data.siteId,
        })
        return error(ErrorCodes.VALIDATION_ERROR, request, {
          message: 'Site not found for this property',
        })
      }

      // Site type config validation on site change
      if (parsed.data.siteId !== currentTask?.site_id) {
        const { data: propRow } = await supabase
          .from('properties')
          .select('site_type_config')
          .eq('id', propertyId)
          .maybeSingle()

        const stConfig = (propRow?.site_type_config as {
          maintenance?: Record<string, boolean>
          allowed_site_types?: string[]
        } | null | undefined) ?? null

        const maintenanceMap = Object.fromEntries(
          Object.entries(stConfig?.maintenance ?? {}).map(([key, value]) => [
            toCanonicalSiteTypeKey(key),
            value,
          ]),
        )

        const allowedSiteTypeSet = new Set(
          Array.isArray(stConfig?.allowed_site_types)
            ? stConfig!.allowed_site_types.map((st) => toCanonicalSiteTypeKey(st))
            : [],
        )

        const siteTypeKey = toCanonicalSiteTypeKey(siteRow.site_type as string | null | undefined)
        if (siteTypeKey) {
          if (allowedSiteTypeSet.size > 0 && !allowedSiteTypeSet.has(siteTypeKey)) {
            logMaintenancePatchValidationFailure(
              request,
              patchLogCtx,
              'Site type not in allowed_site_types for maintenance',
              { siteId: parsed.data.siteId, siteTypeKey },
            )
            return error(ErrorCodes.VALIDATION_ERROR, request, {
              message: 'The selected site is not available for maintenance tasks',
            })
          }
          if (maintenanceMap[siteTypeKey] === false) {
            logMaintenancePatchValidationFailure(
              request,
              patchLogCtx,
              'Site type disabled in maintenance map',
              { siteId: parsed.data.siteId, siteTypeKey },
            )
            return error(ErrorCodes.VALIDATION_ERROR, request, {
              message: 'The selected site is not available for maintenance tasks',
            })
          }
        }
      }


    }

    // Enforce per-category spend limit against edited estimate before updating a work order.
    const nextCategory = parsed.data.category ?? currentTask?.category ?? null
    if (nextCategory) {
      try {
        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const spendLimits = await queries.listSpendLimits(propertyId)
        const matchedLimit = spendLimits.find(
          (sl) => sl.category === nextCategory && sl.alert_enabled,
        )

        if (matchedLimit) {
          const thresholdAmount = Number(matchedLimit.threshold_amount ?? 0)
          const nextEstimatedLaborCost = Number(
            parsed.data.estimatedLaborCost ?? currentTask?.estimated_labor_cost ?? 0,
          )
          const nextEstimatedPartsCost = Number(
            parsed.data.estimatedPartsCost ?? currentTask?.estimated_parts_cost ?? 0,
          )
          const nextEstimatedTotal = nextEstimatedLaborCost + nextEstimatedPartsCost

          if (thresholdAmount > 0 && nextEstimatedTotal > thresholdAmount) {
            logMaintenancePatchValidationFailure(request, patchLogCtx, 'Estimated cost exceeds spend limit', {
              nextCategory,
              nextEstimatedTotal,
              thresholdAmount,
            })
            return error(ErrorCodes.VALIDATION_ERROR, request, {
              message: `Estimated total cost (${nextEstimatedTotal}) exceeds spend limit (${thresholdAmount}) for category ${nextCategory}.`,
            })
          }
        }
      } catch {
        // Non-blocking: if spend-limit lookup fails, continue with existing update flow.
      }
    }

    // Only recompute SLA when both dates are provided and non-null;
    // otherwise don't touch sla (avoids silently clearing an existing SLA).
    const slaUpdate = (parsed.data.scheduledStart && parsed.data.dueDate)
      ? { sla: Math.max(0, Math.round((new Date(parsed.data.dueDate).getTime() - new Date(parsed.data.scheduledStart).getTime()) / 3600000)) }
      : {}

    const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)

    // Reservation conflicts must block schedule edits (guest stays take precedence).
    const nextSiteId = parsed.data.siteId ?? (currentTask?.site_id as string | null | undefined) ?? null
    const nextScheduledStart =
      parsed.data.scheduledStart ?? (currentTask?.scheduled_start as string | null | undefined) ?? null
    const nextDueDate = parsed.data.dueDate ?? (currentTask?.due_date as string | null | undefined) ?? null

    if (nextSiteId && nextScheduledStart && nextDueDate) {
      try {
        const nextScheduledStartDateOnly = new Date(nextScheduledStart).toISOString().slice(0, 10)
        const nextDueDateDateOnly = new Date(nextDueDate).toISOString().slice(0, 10)
        const nextDueDateExclusive = new Date(`${nextDueDateDateOnly}T00:00:00.000Z`)
        nextDueDateExclusive.setUTCDate(nextDueDateExclusive.getUTCDate() + 1)
        const nextDueDateExclusiveDateOnly = nextDueDateExclusive.toISOString().slice(0, 10)

        const { count: resCount, error: resError } = await supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('property_id', propertyId)
          .eq('site_id', nextSiteId)
          .in('status', ['pending', 'confirmed', 'checked_in', 'reserved', 'booked'])
          .lt('check_in_date', nextDueDateExclusiveDateOnly)
          .gt('check_out_date', nextScheduledStartDateOnly)

        if (!resError && resCount != null && resCount > 0) {
          logMaintenancePatchValidationFailure(
            request,
            patchLogCtx,
            'Work order schedule conflicts with reservation',
            { reservationConflicts: resCount, nextSiteId, nextScheduledStart, nextDueDate },
          )
          return error(ErrorCodes.VALIDATION_ERROR, request, {
            message:
              'This work order conflicts with an existing reservation. Please adjust the scheduled dates.',
            reservationConflicts: resCount,
          })
        }
      } catch {
        // Fail-open: if conflict check fails, do not block updates.
      }
    }
    const maintenanceTask = await queries.updateMaintenanceTask({
      id: maintenanceId,
      propertyId,
      ...(parsed.data.siteId !== undefined ? { siteId: parsed.data.siteId } : {}),
      ...(parsed.data.staffId !== undefined && canAssignWorkOrder ? { staffId: parsed.data.staffId } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(effectiveRequestedStatus !== undefined ? { status: effectiveRequestedStatus } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.source !== undefined ? { source: parsed.data.source } : {}),
      ...(parsed.data.estimatedLaborCost !== undefined ? { estimatedLaborCost: parsed.data.estimatedLaborCost } : {}),
      ...(parsed.data.estimatedPartsCost !== undefined ? { estimatedPartsCost: parsed.data.estimatedPartsCost } : {}),
      ...(parsed.data.actualLaborCost !== undefined ? { actualLaborCost: parsed.data.actualLaborCost } : {}),
      ...(parsed.data.actualPartsCost !== undefined ? { actualPartsCost: parsed.data.actualPartsCost } : {}),
      ...(parsed.data.isSuspectedDamage !== undefined ? { isSuspectedDamage: parsed.data.isSuspectedDamage } : {}),
      ...(parsed.data.vendorId !== undefined ? { vendorId: parsed.data.vendorId } : {}),
      ...(parsed.data.guideId !== undefined ? { guideId: parsed.data.guideId } : {}),
      ...slaUpdate,
      ...(parsed.data.scheduledStart !== undefined ? { scheduledStart: parsed.data.scheduledStart } : {}),
      ...(parsed.data.dueDate !== undefined ? { dueDate: parsed.data.dueDate } : {}),
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

      // Direct automation trigger
      try {
        const task = maintenanceTask as any
        const event = new MaintenanceTaskCompletedEvent(
          propertyId,
          maintenanceId,
          task.wo_number ?? '',
          task.category ?? '',
          Number(task.actual_labor_cost ?? 0),
          Number(task.actual_parts_cost ?? 0),
        )
        const context = await buildEventContext(event)
        if (context.propertyId && context.companyId) {
          await runPipelineForTrigger('maintenance.task_completed', context.propertyId, context.companyId, context)
        }
      } catch (autoErr) {
        console.warn('[Maintenance] Direct automation trigger failed (non-blocking)', autoErr)
      }
    }

    // Status-change activity log
    if (access.companyId && effectiveRequestedStatus && currentStatus !== effectiveRequestedStatus) {
      const fromLabel = currentStatus.replace(/_/g, ' ')
      const toLabel = effectiveRequestedStatus.replace(/_/g, ' ')
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
      logMaintenancePatchValidationFailure(request, { propertyId, maintenanceId }, message)
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

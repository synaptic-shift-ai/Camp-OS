import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { HousekeepingQueries, type ListHousekeepingTasksFilters } from '@/lib/dashboard/housekeeping/housekeeping-queries'
import {
  CreateHousekeepingTaskRequestSchema,
  ListHousekeepingTasksQuerySchema,
} from '@/types/api/v1/schemas/housekeeping'

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
 * GET /api/v1/properties/[propertyId]/housekeeping
 *
 * List housekeeping tasks for the property.
 *
 * Query parameters (all optional):
 * - search: free-text match on title, description, or site name/number
 * - siteId: UUID of site
 * - assigneeId: property_staff UUID, or "unassigned"
 * - status: pending | in_progress | done
 * - page: positive integer (default 1)
 * - per_page: 1–100 (default 10)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  try {
    const { propertyId } = await params
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
      permission: 'housekeeping.view_assigned',
    })
    if (isDenied(access)) return access

    const { searchParams } = new URL(request.url)
    const queryRaw = {
      search: searchParams.get('search') ?? undefined,
      siteId: searchParams.get('siteId') ?? undefined,
      assigneeId: searchParams.get('assigneeId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      per_page: searchParams.get('per_page') ?? undefined,
    }

    const parsed = ListHousekeepingTasksQuerySchema.safeParse(queryRaw)
    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.format(),
      })
    }

    const data = parsed.data
    const listFilters: ListHousekeepingTasksFilters = {}
    if (data.search !== undefined) {
      listFilters.search = data.search
    }
    if (data.siteId !== undefined) {
      listFilters.siteId = data.siteId
    }
    if (data.assigneeId !== undefined) {
      listFilters.assigneeId = data.assigneeId
    }
    if (data.status !== undefined) {
      listFilters.status = data.status
    }

    const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
    const [listResult, openTaskCount] = await Promise.all([
      queries.listHousekeepingTasks(
        propertyId,
        Object.keys(listFilters).length > 0 ? listFilters : undefined,
        { page: data.page, perPage: data.per_page },
      ),
      queries.countOpenHousekeepingTasks(propertyId),
    ])
    return success(
      {
        tasks: listResult.tasks,
        total: listResult.total,
        page: data.page,
        per_page: data.per_page,
        openTaskCount,
      },
      request,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Housekeeping API v1] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * POST /api/v1/properties/[propertyId]/housekeeping
 *
 * Create a manual housekeeping task for the property.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
    try {
        const { propertyId } = await params
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
        permission: 'housekeeping.create_manual',
        })
        if (isDenied(access)) return access

        const actionAccess = await resolveModuleActionAccess({
          supabase: supabase as any,
          propertyId,
          userId: user.id,
          moduleKey: 'housekeeping',
          actions: ['create'],
          fallbackForCategory: housekeepingFallbackForCategory,
        })
        if (!actionAccess.create) {
          return error(
            ErrorCodes.AUTH_002.code,
            'You do not have permission to create housekeeping tasks.',
            ErrorCodes.AUTH_002.status,
            request,
          )
        }

        const body = await request.json()
        const parsed = CreateHousekeepingTaskRequestSchema.safeParse(body)

        if (!parsed.success) {
          return error(ErrorCodes.VALIDATION_ERROR, request, {
              errors: parsed.error.format(),
          })
        }

        let reservationId: string | null = null
        if (parsed.data.reservationConfirmationId) {
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
        const housekeepingTask = await queries.createHousekeepingTask({
          propertyId,
          siteId: parsed.data.siteId,
          staffId: parsed.data.staffId ?? null,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          createdBy: user.id,
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
          ...(reservationId !== null ? { reservationId } : {}),
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
              action: 'create',
              resource: 'housekeeping',
              userId: user.id,
              details: `Created housekeeping task "${housekeepingTask.title}" for site ${auditSiteLabel}.`,
            },
            { failOpen: false },
          )
        }

        return success({ housekeepingTask }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Housekeeping API v1] POST error:', err)

        if (
          message === 'Site not found for this property' ||
          message === 'Assignee not found for this property' ||
          message === 'Reservation confirmation id was not found for this property.' ||
          message === 'Checklist template was not found for this property.' ||
          message.startsWith('Invalid date/time value:')
        ) {
        return error(ErrorCodes.VALIDATION_ERROR, request, { message })
        }

        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'
import {
    CreateMaintenanceTaskRequestSchema,
    ListMaintenanceTasksQuerySchema,
} from '@/types/api/v1/schemas/maintenance'
import {
    MaintenanceQueries,
    type ListMaintenanceTasksFilters,
} from '@/lib/dashboard/maintenance/maintenance-queries'

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
            permission: 'maintenance.view_assigned',
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

        const parsed = ListMaintenanceTasksQuerySchema.safeParse(queryRaw)
        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const data = parsed.data
        const listFilters: ListMaintenanceTasksFilters = {}
        if (data.search !== undefined) listFilters.search = data.search
        if (data.siteId !== undefined) listFilters.siteId = data.siteId
        if (data.assigneeId !== undefined) listFilters.assigneeId = data.assigneeId
        if (data.status !== undefined) listFilters.status = data.status

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const [listResult, openTaskCount] = await Promise.all([
            queries.listMaintenanceTasks(
                propertyId,
                Object.keys(listFilters).length > 0 ? listFilters : undefined,
                { page: data.page, perPage: data.per_page },
            ),
            queries.countOpenMaintenanceTasks(propertyId),
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
        console.error('[Maintenance API v1] GET error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

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
            permission: 'maintenance.create_wo',
        })

        if (isDenied(access)) return access

        const actionAccess = await resolveModuleActionAccess({
            supabase: supabase as any,
            propertyId,
            userId: user.id,
            moduleKey: 'maintenance',
            actions: ['create'],
            fallbackForCategory: maintenanceFallbackForCategory,
        })
        if (!actionAccess.create) {
            return error(
                ErrorCodes.AUTH_002.code,
                'You do not have permission to create maintenance tasks.',
                ErrorCodes.AUTH_002.status,
                request,
            )
        }

        const body = await request.json()
        const parsed = CreateMaintenanceTaskRequestSchema.safeParse(body)

        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const maintenanceTask = await queries.createMaintenanceTask({
            propertyId,
            siteId: parsed.data.siteId,
            staffId: parsed.data.staffId ?? null,
            title: parsed.data.title,
            description: parsed.data.description ?? null,
            createdBy: user.id,
            ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        })

        if (access.companyId) {
            const service = createServiceRoleClient()
            const { data: siteRow } = await supabase
                .from('sites')
                .select('site_name, site_number')
                .eq('id', maintenanceTask.site_id)
                .eq('property_id', propertyId)
                .maybeSingle()
            const auditSiteLabel = siteRow?.site_name?.trim()
                || siteRow?.site_number
                || maintenanceTask.site_id
            await recordActivityLog(
                service,
                {
                    companyId: access.companyId,
                    propertyId,
                    action: 'create',
                    resource: 'maintenance',
                    userId: user.id,
                    details: `Created maintenance task "${maintenanceTask.title}" for site ${auditSiteLabel}.`,
                },
                { failOpen: false },
            )
        }

        return success({ maintenanceTask }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance API v1] POST error:', err)

        if (message === 'Site not found for this property' || message === 'Assignee not found for this property') {
            return error(ErrorCodes.VALIDATION_ERROR, request, { message })
        }

        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}
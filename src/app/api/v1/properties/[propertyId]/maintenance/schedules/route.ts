import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { CreateScheduleSchema } from '@/types/api/v1/schemas/maintenance'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'

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
        const search = searchParams.get('search') ?? undefined
        const siteId = searchParams.get('siteId') ?? undefined

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const schedules = await queries.listSchedules(propertyId, {
            ...(search ? { search } : {}),
            ...(siteId ? { siteId } : {}),
        })

        return success({ schedules }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance Schedules API] GET error:', err)
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

        const body = await request.json()
        const parsed = CreateScheduleSchema.safeParse(body)

        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const schedule = await queries.createSchedule(propertyId, {
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            siteId: parsed.data.site_id ?? null,
            assignedTo: parsed.data.assigned_to ?? null,
            frequency: parsed.data.frequency,
            days: parsed.data.days ?? null,
            scheduleDate: parsed.data.schedule_date ?? null,
            createdBy: user.id,
        })

        if (access.companyId) {
            const service = createServiceRoleClient()
            await recordActivityLog(
                service,
                {
                    companyId: access.companyId,
                    propertyId,
                    action: 'create',
                    resource: 'maintenance_schedule',
                    userId: user.id,
                    details: `Created maintenance schedule "${schedule.name}".`,
                },
                { failOpen: false },
            )
        }

        return success({ schedule }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance Schedules API] POST error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

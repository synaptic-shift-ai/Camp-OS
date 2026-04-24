import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'
import { UpdateScheduleSchema } from '@/types/api/v1/schemas/maintenance'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ propertyId: string; scheduleId: string }> },
) {
    try {
        const { propertyId, scheduleId } = await params
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

        const body = await request.json()
        const parsed = UpdateScheduleSchema.safeParse(body)

        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const schedule = await queries.updateSchedule(scheduleId, propertyId, {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
            ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
            ...(parsed.data.site_id !== undefined ? { siteId: parsed.data.site_id } : {}),
            ...(parsed.data.assigned_to !== undefined ? { assignedTo: parsed.data.assigned_to } : {}),
            ...(parsed.data.frequency !== undefined ? { frequency: parsed.data.frequency } : {}),
            ...(parsed.data.days !== undefined ? { days: parsed.data.days } : {}),
            ...(parsed.data.schedule_date !== undefined ? { scheduleDate: parsed.data.schedule_date } : {}),
        })

        if (access.companyId) {
            const service = createServiceRoleClient()
            await recordActivityLog(
                service,
                {
                    companyId: access.companyId,
                    propertyId,
                    action: 'update',
                    resource: 'maintenance_schedule',
                    userId: user.id,
                    details: `Updated maintenance schedule "${schedule.name}".`,
                },
                { failOpen: false },
            )
        }

        return success({ schedule }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance Schedules API] PATCH error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ propertyId: string; scheduleId: string }> },
) {
    try {
        const { propertyId, scheduleId } = await params
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

        // Fetch schedule name for audit log before deletion
        const { data: existingSchedule } = await supabase
            .from('maintenance_schedule')
            .select('name')
            .eq('id', scheduleId)
            .eq('property_id', propertyId)
            .maybeSingle()

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        await queries.deleteSchedule(scheduleId, propertyId)

        if (access.companyId) {
            const service = createServiceRoleClient()
            await recordActivityLog(
                service,
                {
                    companyId: access.companyId,
                    propertyId,
                    action: 'delete',
                    resource: 'maintenance_schedule',
                    userId: user.id,
                    details: `Deleted maintenance schedule "${existingSchedule?.name ?? scheduleId}".`,
                },
                { failOpen: false },
            )
        }

        return success({ deleted: true }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance Schedules API] DELETE error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

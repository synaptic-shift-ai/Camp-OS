import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'

const GenerateWorkOrderSchema = z.object({
    scheduleId: z.string().uuid(),
})

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
        const parsed = GenerateWorkOrderSchema.safeParse(body)

        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const { scheduleId } = parsed.data

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const task = await queries.generateWorkOrderForSchedule(scheduleId, propertyId)

        return success({ maintenanceTask: task }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance Schedules API] Generate POST error:', err)

        if (message === 'An open or in-progress work order already exists for this schedule') {
            return error(ErrorCodes.VALIDATION_ERROR, request, { message })
        }

        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

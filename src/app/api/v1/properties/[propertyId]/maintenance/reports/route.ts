import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceReportQuerySchema } from '@/types/api/v1/schemas/maintenance'
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
            permission: 'maintenance.view_cost_reports',
        })
        if (isDenied(access)) return access

        const { searchParams } = new URL(request.url)
        const queryRaw = {
            from: searchParams.get('from') ?? undefined,
            to: searchParams.get('to') ?? undefined,
        }

        const parsed = MaintenanceReportQuerySchema.safeParse(queryRaw)
        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const report = await queries.getMaintenanceReportSummary(propertyId, {
            ...(parsed.data.from !== undefined ? { from: parsed.data.from } : {}),
            ...(parsed.data.to !== undefined ? { to: parsed.data.to } : {}),
        })

        return success(report, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance Reports API v1] GET error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

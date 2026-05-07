import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'
import { z } from 'zod'

const BookingConflictsQuerySchema = z.object({
    siteId: z.string().min(1, 'siteId is required'),
    startDate: z.string().min(1, 'startDate is required'),
    endDate: z.string().min(1, 'endDate is required'),
})

/**
 * GET /api/v1/properties/[propertyId]/maintenance/booking-conflicts
 *
 * Returns active maintenance tasks that overlap with the given date range for a site.
 * Used by the booking flow to warn about potential conflicts.
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
            permission: 'maintenance.view_assigned',
        })
        if (isDenied(access)) return access

        const { searchParams } = new URL(request.url)
        const raw = {
            siteId: searchParams.get('siteId') ?? undefined,
            startDate: searchParams.get('startDate') ?? undefined,
            endDate: searchParams.get('endDate') ?? undefined,
        }

        const parsed = BookingConflictsQuerySchema.safeParse(raw)
        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const conflicts = await queries.findOverlappingMaintenance(
            parsed.data.siteId,
            parsed.data.startDate,
            parsed.data.endDate,
        )

        // Check for overlapping reservations
        let reservationConflicts = 0
        try {
            const { count: resCount, error: resError } = await supabase
                .from('reservations')
                .select('id', { count: 'exact', head: true })
                .eq('site_id', parsed.data.siteId)
                .in('status', ['confirmed', 'checked_in', 'pending'])
                .lt('check_in_date', parsed.data.endDate)
                .gt('check_out_date', parsed.data.startDate)

            if (!resError && resCount != null) {
                reservationConflicts = resCount
            }
        } catch {
            // Non-blocking
        }

        return success({ maintenanceConflicts: conflicts.length, reservationConflicts }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance booking-conflicts API v1] GET error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

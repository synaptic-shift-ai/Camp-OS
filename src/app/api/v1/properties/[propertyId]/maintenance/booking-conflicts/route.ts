import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyMembership, isDenied, hasPermission, staffHasPermission } from '@/lib/rbac'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'
import { z } from 'zod'

const BookingConflictsQuerySchema = z.object({
    siteId: z.string().min(1, 'siteId is required'),
    startDate: z.string().min(1, 'startDate is required'),
    endDate: z.string().min(1, 'endDate is required'),
})

function addDaysDateOnly(dateOnly: string, days: number): string {
    const base = new Date(`${dateOnly}T00:00:00.000Z`)
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
    return next.toISOString().slice(0, 10)
}

/**
 * GET /api/v1/properties/[propertyId]/maintenance/booking-conflicts
 *
 * Returns active maintenance tasks and reservation counts that overlap with the given date range for a site.
 * Used by maintenance + booking flows to warn about potential conflicts.
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

        const access = await requirePropertyMembership(
            supabase as unknown as SupabaseClient,
            user.id,
            propertyId,
        )
        if (isDenied(access)) return access

        // Allow users who can either view assigned maintenance OR create work orders
        // to see conflicts while scheduling a WO.
        const canViewConflicts =
            (access.role ? hasPermission(access.role, 'maintenance.view_assigned') : false)
            || (access.role ? hasPermission(access.role, 'maintenance.create_wo') : false)
            || staffHasPermission(access.categories, 'maintenance.view_assigned')
            || staffHasPermission(access.categories, 'maintenance.create_wo')

        if (!canViewConflicts) {
            return error(ErrorCodes.AUTH_002, request)
        }

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
        let firstReservationConflict: {
            confirmationNumber: string | null
            checkInDate: string
            checkOutDate: string
        } | null = null
        const startDateOnly = new Date(parsed.data.startDate).toISOString().slice(0, 10)
        const endDateOnly = new Date(parsed.data.endDate).toISOString().slice(0, 10)
        const endDateExclusive = addDaysDateOnly(endDateOnly, 1)

        try {
            const { count: resCount, error: resError } = await supabase
                .from('reservations')
                .select('id', { count: 'exact', head: true })
                .eq('property_id', propertyId)
                .eq('site_id', parsed.data.siteId)
                .in('status', ['pending', 'confirmed', 'checked_in', 'reserved', 'booked'])
                .lt('check_in_date', endDateExclusive)
                .gt('check_out_date', startDateOnly)

            if (!resError && resCount != null) {
                reservationConflicts = resCount
            }

            if (!resError && resCount != null && resCount > 0) {
                const { data: firstRows, error: firstError } = await supabase
                    .from('reservations')
                    .select('confirmation_number, check_in_date, check_out_date')
                    .eq('property_id', propertyId)
                    .eq('site_id', parsed.data.siteId)
                    .in('status', ['pending', 'confirmed', 'checked_in', 'reserved', 'booked'])
                    .lt('check_in_date', endDateExclusive)
                    .gt('check_out_date', startDateOnly)
                    .order('check_in_date', { ascending: true })
                    .limit(1)
                
                const first = Array.isArray(firstRows) ? firstRows[0] : null

                if (!firstError && first?.check_in_date && first?.check_out_date) {
                    firstReservationConflict = {
                        confirmationNumber:
                            typeof first.confirmation_number === 'string'
                                ? first.confirmation_number
                                : null,
                        checkInDate: String(first.check_in_date),
                        checkOutDate: String(first.check_out_date),
                    }
                }
            }
        } catch {
            // Non-blocking
        }

        return success(
            {
                maintenanceConflicts: conflicts.length,
                reservationConflicts,
                firstReservationConflict,
            },
            request,
        )
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance booking-conflicts API v1] GET error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

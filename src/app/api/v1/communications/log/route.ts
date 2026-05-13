import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'

// ============================================================================
// GET — Query delivery log entries
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const sp = request.nextUrl.searchParams
    const propertyId = sp.get('propertyId')
    if (!propertyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId query parameter is required' })
    }

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'guest_comms.view_delivery_log',
    })
    if (isDenied(access)) return access

    // Use service-role for delivery log reads so joins (e.g. reservation confirmation_number)
    // are not impacted by RLS, while still enforcing access + tenant scoping explicitly.
    const db = createServiceRoleClient() as any

    // ── groupBy=status mode: return counts per status ──────────────────────
    const groupBy = sp.get('groupBy')
    if (groupBy === 'status') {
      const { data, error: queryError } = await db
        .from('communication_log')
        .select('status')
        .eq('property_id', propertyId)

      if (queryError) {
        return error(ErrorCodes.INTERNAL_ERROR, request, { message: queryError.message })
      }

      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        counts[row.status] = (counts[row.status] ?? 0) + 1
      }

      return success({ counts, total: data?.length ?? 0 }, request)
    }

    // ── Standard paginated query ────────────────────────────────────────────
    const reservationId = sp.get('reservationId')
    const guestId = sp.get('guestId')
    const status = sp.get('status')
    const channel = sp.get('channel')
    const dateFrom = sp.get('dateFrom')
    const dateTo = sp.get('dateTo')
    const aggregate =
      sp.get('aggregate') === '1' ||
      sp.get('aggregate') === 'true'

    const parsedLimit = parseInt(sp.get('limit') ?? '20', 10) || 20
    const maxLimit = aggregate && dateFrom ? 10_000 : 100
    const limit = Math.min(Math.max(parsedLimit, 1), maxLimit)
    const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0)

    let query = db
      .from('communication_log')
      .select(`
        id,
        reservation_id,
        guest_id,
        template_id,
        channel,
        recipient_address,
        subject,
        status,
        bounce_type,
        failure_reason,
        opened_at,
        clicked_at,
        retry_count,
        created_at,
        delivered_at,
        reservation:reservation_id(confirmation_number),
        guest:guest_id(first_name, last_name, email),
        template:template_id(name)
      `, { count: 'exact' })
      .eq('property_id', propertyId)

    if (reservationId) query = query.eq('reservation_id', reservationId)
    if (guestId) query = query.eq('guest_id', guestId)
    if (status) query = query.eq('status', status)
    if (channel) query = query.eq('channel', channel)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo)

    query = query.order('created_at', { ascending: false })
    query = query.range(offset, offset + limit - 1)

    const { data, count, error: queryError } = await query

    if (queryError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: queryError.message })
    }

    return success({ data: data ?? [], count: count ?? 0 }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import {
  mapCommunicationOptOutRow,
  type CommunicationOptOutRow,
} from '@/lib/communications/opt-out-records'

// ============================================================================
// GET — Query opt-out registry entries
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

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'guest_comms.view_opt_out_list',
    })
    if (isDenied(access)) return access
    if (!access.companyId) {
      return error(ErrorCodes.PROP_001, request)
    }

    const parsedLimit = parseInt(sp.get('limit') ?? '20', 10) || 20
    const limit = Math.min(Math.max(parsedLimit, 1), 100)
    const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0)
    const channel = sp.get('channel')

    // Service-role reads avoid RLS surprises while access and company scoping
    // are enforced explicitly above.
    const db = createServiceRoleClient()

    let query = db
      .from('communication_opt_outs')
      .select(`
        id,
        channel,
        opted_out_at,
        source,
        guest:guest_id(first_name, last_name, email)
      `, { count: 'exact' })
      .eq('company_id', access.companyId)

    if (channel) query = query.eq('channel', channel)

    query = query.order('opted_out_at', { ascending: false })
    query = query.range(offset, offset + limit - 1)

    const [{ data, count, error: queryError }, { data: countRows, error: countError }] =
      await Promise.all([
        query,
        db
          .from('communication_opt_outs')
          .select('channel')
          .eq('company_id', access.companyId),
      ])

    if (queryError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: queryError.message })
    }

    if (countError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: countError.message })
    }

    const counts = { email: 0, sms: 0 }
    for (const row of countRows ?? []) {
      if (row.channel === 'email') counts.email += 1
      if (row.channel === 'sms') counts.sms += 1
    }

    return success(
      {
        data: ((data ?? []) as CommunicationOptOutRow[]).map(mapCommunicationOptOutRow),
        count: count ?? 0,
        counts,
      },
      request,
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

// ============================================================================
// DELETE — Remove opt-out (guest may receive that channel again)
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const sp = request.nextUrl.searchParams
    const propertyId = sp.get('propertyId')
    const optOutId = sp.get('id')
    if (!propertyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId query parameter is required' })
    }
    if (!optOutId) {
      return error(ErrorCodes.VAL_002, request, { message: 'id query parameter is required' })
    }

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'guest_comms.configure_branding',
    })
    if (isDenied(access)) return access
    if (!access.companyId) {
      return error(ErrorCodes.PROP_001, request)
    }

    const db = createServiceRoleClient()

    const { data: row, error: fetchError } = await db
      .from('communication_opt_outs')
      .select('id, company_id')
      .eq('id', optOutId)
      .maybeSingle()

    if (fetchError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: fetchError.message })
    }
    if (!row || row.company_id !== access.companyId) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Opt-out record not found' })
    }

    const { error: deleteError } = await db
      .from('communication_opt_outs')
      .delete()
      .eq('id', optOutId)
      .eq('company_id', access.companyId)

    if (deleteError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: deleteError.message })
    }

    return success({ deleted: true }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

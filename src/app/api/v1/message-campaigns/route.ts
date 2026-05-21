/**
 * Message Campaigns API v1 — List & Create
 *
 * GET  /api/v1/message-campaigns  — List campaigns for a property
 * POST /api/v1/message-campaigns  — Create a new campaign (draft)
 */

import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { CreateCampaignSchema } from '@/lib/messaging/schemas'

// ============================================================================
// GET — List campaigns
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

    const access = await requirePropertyAccess(supabase as never, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'guest_comms.view_delivery_log' as any,
    })
    if (isDenied(access)) return access

    const companyId = access.companyId
    if (!companyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'Could not determine tenant for property' })
    }

    const db = createServiceRoleClient() as any

    let query = db
      .from('message_campaigns')
      .select('*', { count: 'exact' })
      .eq('property_id', propertyId)

    const status = sp.get('status')
    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('created_at', { ascending: false })

    // Pagination
    const limit = Math.min(Math.max(Number(sp.get('limit') || 10), 1), 100)
    const offset = Math.max(Number(sp.get('offset') || 0), 0)
    query = query.range(offset, offset + limit - 1)

    const { data: campaigns, count, error: queryError } = await query

    if (queryError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: queryError.message })
    }

    return success({ campaigns: campaigns ?? [], count: count ?? 0 }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

// ============================================================================
// POST — Create campaign
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const sp = request.nextUrl.searchParams
    const propertyId = sp.get('propertyId')
    if (!propertyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId query parameter is required' })
    }

    const access = await requirePropertyAccess(supabase as never, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'guest_comms.edit_templates' as any,
    })
    if (isDenied(access)) return access

    const companyId = access.companyId
    if (!companyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'Could not determine tenant for property' })
    }

    const body = await request.json()
    const parsed = CreateCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const data = parsed.data
    const db = createServiceRoleClient() as any

    const { data: campaign, error: insertError } = await db
      .from('message_campaigns')
      .insert({
        company_id: companyId,
        property_id: propertyId,
        name: data.name,
        channel: data.channel,
        segment_type: data.segment_type ?? null,
        audience_filter: data.audience_filter ?? {},
        template_id: data.template_id ?? null,
        subject: data.subject ?? null,
        body: data.body,
        status: 'draft',
        created_by: user.id,
      })
      .select('*')
      .single()

    if (insertError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: insertError.message })
    }

    return success({ campaign }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * Message Campaign Results API v1
 *
 * GET /api/v1/message-campaigns/[id]/results — Get aggregated campaign result counts
 */

import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'

// ============================================================================
// GET — Campaign result counts
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: campaignId } = await params
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

    const serviceClient = createServiceRoleClient() as any

    // Verify campaign exists and belongs to property
    const { data: campaign, error: fetchError } = await serviceClient
      .from('message_campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('property_id', propertyId)
      .single()

    if (fetchError || !campaign) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Campaign not found' })
    }

    // Aggregate recipients by status
    const { data: recipients, error: queryError } = await serviceClient
      .from('message_recipients')
      .select('status')
      .eq('campaign_id', campaignId)

    if (queryError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: queryError.message })
    }

    const counts = {
      total: recipients?.length ?? 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    }

    for (const r of recipients ?? []) {
      if (r.status in counts) {
        counts[r.status as keyof typeof counts]++
      }
    }

    return success({ results: counts }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

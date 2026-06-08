/**
 * Message Campaign Cancel API v1
 *
 * POST /api/v1/message-campaigns/[id]/cancel — Cancel a scheduled campaign
 */

import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'

export async function POST(
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
      permission: 'guest_comms.edit_templates' as any,
    })
    if (isDenied(access)) return access

    const companyId = access.companyId
    if (!companyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'Could not determine tenant for property' })
    }

    const serviceClient = createServiceRoleClient() as any

    const { data: campaign, error: fetchError } = await serviceClient
      .from('message_campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .eq('property_id', propertyId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !campaign) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Campaign not found' })
    }

    if (campaign.status !== 'scheduled') {
      return error(ErrorCodes.VAL_001, request, {
        message: `Only scheduled campaigns can be cancelled (current status: ${campaign.status})`,
      })
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await serviceClient
      .from('message_campaigns')
      .update({
        status: 'cancelled',
        scheduled_at: null,
        updated_at: now,
      })
      .eq('id', campaignId)
      .select('*')
      .single()

    if (updateError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: updateError.message })
    }

    return success({ campaign: updated }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * Message Campaign Schedule API v1
 *
 * POST /api/v1/message-campaigns/[id]/schedule — Schedule a campaign for future delivery
 */

import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { ScheduleCampaignSchema } from '@/lib/messaging/schemas'

// ============================================================================
// POST — Schedule campaign
// ============================================================================

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
      .select('*')
      .eq('id', campaignId)
      .eq('property_id', propertyId)
      .single()

    if (fetchError || !campaign) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Campaign not found' })
    }

    // Validate schedule input
    const body = await request.json()
    const parsed = ScheduleCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    // Update campaign status and scheduled_at
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await serviceClient
      .from('message_campaigns')
      .update({
        status: 'scheduled',
        scheduled_at: parsed.data.scheduled_at,
        updated_at: now,
      })
      .eq('id', campaignId)
      .select('*')
      .single()

    if (updateError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: updateError.message })
    }

    const scheduledAt = updated.scheduled_at
    try {
      const { recordActivityLog } = await import('@/shared/activity-log/record-activity-log')
      const serviceRole = createServiceRoleClient()
      await recordActivityLog(serviceRole, {
        companyId,
        propertyId: campaign.property_id ?? null,
        action: 'schedule',
        resource: 'campaign',
        userId: user.id,
        details: `Scheduled campaign '${campaign.name}' for ${scheduledAt ?? 'unknown time'}`,
      })
    } catch (logError) {
      console.error('[Campaigns] Failed to log activity:', logError)
    }

    return success({ campaign: updated }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

/**
 * Message Campaign Send API v1
 *
 * POST /api/v1/message-campaigns/[id]/send — Send campaign now
 *
 * Validates campaign status, segments guests, and executes the send pipeline.
 */

import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { getGuestsBySegment, filterEligibleGuests } from '@/lib/messaging/segmentation'
import { executeCampaignSend } from '@/lib/messaging/send'
import type { MessageCampaign, SegmentType } from '@/lib/messaging/messaging-types'

// ============================================================================
// POST — Send campaign immediately
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

    // Fetch campaign and verify ownership
    const { data: campaign, error: fetchError } = await serviceClient
      .from('message_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('property_id', propertyId)
      .single()

    if (fetchError || !campaign) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Campaign not found' })
    }

    // Verify campaign is in a sendable status
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return error(ErrorCodes.VAL_001, request, {
        message: `Campaign cannot be sent (current status: ${campaign.status})`,
      })
    }

    // Segment guests
    const segmentType = (campaign.segment_type ?? 'all_guests') as SegmentType
    const guests = await getGuestsBySegment(
      serviceClient,
      propertyId,
      segmentType,
      campaign.audience_filter,
    )

    // Filter eligible guests
    const eligibleGuests = await filterEligibleGuests(
      guests,
      campaign.channel,
      serviceClient,
      companyId,
    )

    // Execute send
    const summary = await executeCampaignSend(
      serviceClient,
      campaign as unknown as MessageCampaign,
      eligibleGuests,
    )

    return success({ summary, campaignId }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

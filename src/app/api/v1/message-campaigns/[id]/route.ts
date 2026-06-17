/**
 * Message Campaign API v1 — Update
 *
 * PATCH /api/v1/message-campaigns/[id] — Update a draft or scheduled campaign
 */

import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { UpdateCampaignSchema } from '@/lib/messaging/schemas'

export async function PATCH(
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

    const body = await request.json()
    const parsed = UpdateCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const db = createServiceRoleClient() as any

    const { data: existing, error: fetchError } = await db
      .from('message_campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .eq('property_id', propertyId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !existing) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Campaign not found' })
    }

    if (existing.status !== 'draft' && existing.status !== 'scheduled') {
      return error(ErrorCodes.VAL_001, request, {
        message: `Campaign cannot be updated (current status: ${existing.status})`,
      })
    }

    const data = parsed.data
    const updateRow: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (data.name !== undefined) updateRow.name = data.name
    if (data.channel !== undefined) updateRow.channel = data.channel
    if (data.segment_type !== undefined) updateRow.segment_type = data.segment_type
    if (data.audience_filter !== undefined) updateRow.audience_filter = data.audience_filter
    if (data.template_id !== undefined) updateRow.template_id = data.template_id
    if (data.subject !== undefined) updateRow.subject = data.subject
    if (data.body !== undefined) updateRow.body = data.body
    if (data.status !== undefined) updateRow.status = data.status

    const { data: campaign, error: updateError } = await db
      .from('message_campaigns')
      .update(updateRow)
      .eq('id', campaignId)
      .select('*')
      .single()

    if (updateError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: updateError.message })
    }

    try {
      const { recordActivityLog } = await import('@/shared/activity-log/record-activity-log')
      const serviceRole = createServiceRoleClient()
      await recordActivityLog(serviceRole, {
        companyId,
        propertyId: campaign.property_id ?? null,
        action: 'update',
        resource: 'campaign',
        userId: user.id,
        details: `Updated campaign '${campaign.name}'`,
      })
    } catch (logError) {
      console.error('[Campaigns] Failed to log activity:', logError)
    }

    return success({ campaign }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

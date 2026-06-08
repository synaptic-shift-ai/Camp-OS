/**
 * Message Campaign Preview API v1
 *
 * POST /api/v1/message-campaigns/preview — Preview recipients & sample messages
 *
 * Validates campaign input without creating any DB records.
 * Returns recipient count, sample personalized messages, and warnings.
 */

import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { PreviewCampaignSchema } from '@/lib/messaging/schemas'
import { getGuestsBySegment, filterEligibleGuests } from '@/lib/messaging/segmentation'
import { buildCampaignGuestContext, personalizeCampaignMessage } from '@/lib/messaging/campaign-context'
import type { SegmentType } from '@/lib/messaging/messaging-types'

// ============================================================================
// POST — Preview campaign recipients
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
    const parsed = PreviewCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const data = parsed.data
    const serviceClient = createServiceRoleClient() as any

    // Fetch guests for the chosen segment
    const segmentType = (data.segment_type ?? 'all_guests') as SegmentType
    const guests = await getGuestsBySegment(
      serviceClient,
      propertyId,
      segmentType,
      data.audience_filter as any,
    )

    // Filter to eligible guests (contact info available, not opted out)
    const eligibleGuests = await filterEligibleGuests(
      guests,
      data.channel,
      serviceClient,
      companyId,
    )

    // Build sample messages (up to 5)
    const sampleGuests = eligibleGuests.slice(0, 5)
    const sampleMessages = await Promise.all(
      sampleGuests.map(async (guest) => {
        const context = await buildCampaignGuestContext(
          serviceClient,
          propertyId,
          guest as unknown as Record<string, unknown>,
        )
        const personalized = await personalizeCampaignMessage(serviceClient, {
          propertyId,
          channel: data.channel,
          subject: data.subject ?? null,
          body: data.body,
          context,
        })
        return {
          guest_id: guest.id,
          guest_name: `${guest.first_name} ${guest.last_name}`,
          personalized_subject: personalized.subject,
          personalized_body: personalized.body,
        }
      }),
    )

    // Compute warnings
    const warnings: string[] = []
    const missingEmail = guests.filter(
      (g) => !g.email || g.email.trim() === '',
    ).length
    const missingPhone = guests.filter(
      (g) => !g.phone || g.phone.trim() === '',
    ).length
    const optedOutCount = guests.length - eligibleGuests.length - missingEmail - missingPhone

    if (missingEmail > 0) {
      warnings.push(`${missingEmail} guest(s) missing email address`)
    }
    if (missingPhone > 0) {
      warnings.push(`${missingPhone} guest(s) missing phone number`)
    }
    if (optedOutCount > 0) {
      warnings.push(`${optedOutCount} guest(s) opted out or not eligible`)
    }

    return success(
      {
        recipient_count: eligibleGuests.length,
        total_guests: guests.length,
        sample_messages: sampleMessages,
        warnings,
      },
      request,
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

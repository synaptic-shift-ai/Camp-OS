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

const LOG_PREFIX = '[Campaign Preview]'

function logPreviewFailure(
  reason: string,
  context: Record<string, unknown>,
): void {
  console.warn(LOG_PREFIX, { reason, ...context })
}

function summarizePreviewBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return { bodyType: typeof body }
  }

  const payload = body as Record<string, unknown>
  const subject = payload.subject
  const bodyText = payload.body

  return {
    name: payload.name,
    hasName: typeof payload.name === 'string' && payload.name.trim().length > 0,
    channel: payload.channel,
    segment_type: payload.segment_type,
    hasSubject: typeof subject === 'string' && subject.trim().length > 0,
    subjectLength: typeof subject === 'string' ? subject.length : 0,
    bodyLength: typeof bodyText === 'string' ? bodyText.length : 0,
    hasAudienceFilter: payload.audience_filter != null,
    template_id: payload.template_id ?? null,
  }
}

// ============================================================================
// POST — Preview campaign recipients
// ============================================================================

export async function POST(request: NextRequest) {
  const propertyId = request.nextUrl.searchParams.get('propertyId')

  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) {
      logPreviewFailure('authentication_failed', {
        propertyId,
        authError: authError?.message ?? 'no_user',
      })
      return error(ErrorCodes.AUTH_001, request)
    }

    if (!propertyId) {
      logPreviewFailure('missing_property_id', { userId: user.id })
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId query parameter is required' })
    }

    const access = await requirePropertyAccess(supabase as never, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'guest_comms.edit_templates' as any,
    })
    if (isDenied(access)) {
      logPreviewFailure('access_denied', {
        propertyId,
        userId: user.id,
        status: access.status,
      })
      return access
    }

    const companyId = access.companyId
    if (!companyId) {
      logPreviewFailure('missing_company_id', { propertyId, userId: user.id })
      return error(ErrorCodes.VAL_002, request, { message: 'Could not determine tenant for property' })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch (parseError) {
      logPreviewFailure('invalid_json_body', {
        propertyId,
        userId: user.id,
        error: parseError instanceof Error ? parseError.message : 'unknown_parse_error',
      })
      return error(ErrorCodes.VAL_001, request, {
        message: 'Request body must be valid JSON',
      })
    }

    const parsed = PreviewCampaignSchema.safeParse(body)
    if (!parsed.success) {
      logPreviewFailure('validation_failed', {
        propertyId,
        userId: user.id,
        payload: summarizePreviewBody(body),
        zodErrors: parsed.error.flatten(),
      })
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const data = parsed.data
    const serviceClient = createServiceRoleClient() as any
    const previewSubject =
      data.channel === 'sms'
        ? null
        : data.subject?.trim() || '(No subject)'

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
          subject: previewSubject,
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
    if (
      (data.channel === 'email' || data.channel === 'both') &&
      !data.subject?.trim()
    ) {
      warnings.push('Subject is empty — add one before sending')
    }
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
    console.error(LOG_PREFIX, {
      reason: 'unexpected_error',
      propertyId,
      message,
      stack: err instanceof Error ? err.stack : undefined,
    })
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

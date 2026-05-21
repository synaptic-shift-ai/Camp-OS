/**
 * Guest Direct Message API v1
 *
 * POST /api/v1/guests/[id]/messages — Send a one-to-one message to a guest
 */

import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { SendOneMessageSchema } from '@/lib/messaging/schemas'
import { executeDirectSend } from '@/lib/messaging/send'

// ============================================================================
// POST — Send direct message to guest
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: guestId } = await params
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

    // Validate request body
    const body = await request.json()
    const parsed = SendOneMessageSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const data = parsed.data

    // Verify guest exists and belongs to property
    const serviceClient = createServiceRoleClient() as any
    const { data: guest, error: guestError } = await serviceClient
      .from('guests')
      .select('id')
      .eq('id', guestId)
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .maybeSingle()

    if (guestError || !guest) {
      return error(ErrorCodes.GUEST_001, request, { message: 'Guest not found' })
    }

    // Execute direct send
    const summary = await executeDirectSend(serviceClient, {
      companyId,
      propertyId,
      guestId,
      channel: data.channel,
      ...(data.subject != null ? { subject: data.subject } : {}),
      body: data.body,
      createdBy: user.id,
    })

    return success({ summary }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

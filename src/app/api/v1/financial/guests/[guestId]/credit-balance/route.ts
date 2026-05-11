/**
 * Financial API v1 - Guest Credit Balance
 *
 * GET /api/v1/financial/guests/[guestId]/credit-balance
 * Get property-scoped guest credit balance.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { getEffectiveGuestCreditAvailableCents } from '@/modules/Financial/application/guestCreditBalance'

/**
 * GET /api/v1/financial/guests/[guestId]/credit-balance
 *
 * Query params:
 *   propertyId (required) - property UUID to scope the balance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guestId: string }> },
) {
  try {
    const { guestId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, request)
    }

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!propertyId) {
      console.warn('[Financial API v1] Guest credit balance missing propertyId', { guestId })
      return error(
        ErrorCodes.VALIDATION_ERROR,
        'propertyId query parameter is required',
        400,
        request,
      )
    }

    // RBAC
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'financial.view_transactions',
    })
    if (isDenied(access)) {
      console.warn('[Financial API v1] Guest credit balance access denied', { guestId, propertyId })
      return access
    }

    // Verify guest belongs to this property
    const { data: guest } = await supabase
      .from('guests')
      .select('id, property_id, guest_credit_cents')
      .eq('id', guestId)
      .eq('property_id', propertyId)
      .maybeSingle()

    if (!guest) {
      console.warn('[Financial API v1] Guest credit balance guest not found for property', { guestId, propertyId })
      return error(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Guest not found for this property',
        404,
        request,
      )
    }

    const serviceRole = createServiceRoleClient()
    const effective = await getEffectiveGuestCreditAvailableCents(serviceRole, guestId, propertyId)

    return success(
      {
        guest_id: guestId,
        property_id: propertyId,
        total_credits_cents: effective.ledger.totalCredits,
        total_used_cents: effective.ledger.totalUsed,
        ledger_balance_cents: effective.ledger.creditBalance,
        guests_table_guest_credit_cents: effective.guestsColumnCents,
        credit_balance_cents: effective.effectiveAvailableCents,
      },
      request,
    )
  } catch (err: unknown) {
    console.error('[Financial API v1] Guest credit balance error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to get guest credit balance',
      500,
      request,
      { message },
    )
  }
}

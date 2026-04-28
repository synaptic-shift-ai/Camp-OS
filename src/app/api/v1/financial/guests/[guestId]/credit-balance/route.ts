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
import { getGuestCreditBalance } from '@/modules/Financial/application/guestCreditBalance'

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
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 },
      )
    }

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!propertyId) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'propertyId query parameter is required'),
        { status: 400 },
      )
    }

    // RBAC
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'staff',
      permission: 'financial.view_transactions',
    })
    if (isDenied(access)) return access

    // Verify guest belongs to this property
    const { data: guest } = await supabase
      .from('guests')
      .select('id, property_id')
      .eq('id', guestId)
      .eq('property_id', propertyId)
      .maybeSingle()

    if (!guest) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found for this property'),
        { status: 404 },
      )
    }

    const serviceRole = createServiceRoleClient()
    const balance = await getGuestCreditBalance(serviceRole, guestId, propertyId)

    return NextResponse.json(
      success({
        guest_id: guestId,
        property_id: propertyId,
        total_credits_cents: balance.totalCredits,
        total_used_cents: balance.totalUsed,
        credit_balance_cents: balance.creditBalance,
      }),
    )
  } catch (err: unknown) {
    console.error('[Financial API v1] Guest credit balance error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to get guest credit balance', { message }),
      { status: 500 },
    )
  }
}

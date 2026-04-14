/**
 * Properties API v1 - Stripe Account Management
 *
 * Phase 4, Week 13-14: API Deprecation & Cleanup
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 * Replaces: POST /api/dashboard/properties/{id}/stripe-disconnect (deprecated)
 *
 * Manages Stripe Connect account linking/unlinking for a property.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { GetPropertyQueryHandler } from '@/modules/PropertyManagement/application/queries/GetPropertyQuery'
import { SupabasePropertyRepository } from '@/modules/PropertyManagement/infrastructure/SupabasePropertyRepository'
import { resolveDashboardAccess, canAccessPropertySettings } from '@/lib/rbac/dashboard-guards'
/**
 * DELETE /api/v1/properties/[propertyId]/stripe-account
 *
 * Disconnect Stripe Connect account from a property.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId: id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    const repository = new SupabasePropertyRepository(supabase)
    const queryHandler = new GetPropertyQueryHandler(repository)
    const property = await queryHandler.execute({ id })

    if (!property) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'),
        { status: 404 }
      )
    }

    const dashAccess = await resolveDashboardAccess(supabase, id, user.id)
    const allowedForPropertySettings = !!dashAccess && canAccessPropertySettings(dashAccess)
    if (!allowedForPropertySettings) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - insufficient permissions for property settings'),
        { status: 403 }
      )
    }

    // RBAC: verify user has owner/manager access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: id,
      minimumRole: 'owner',
    })
    if (isDenied(access)) return access

    // Disconnect Stripe by setting to notConnected state
    // Note: This is done at the infrastructure level since connectStripe exists
    // but there's no disconnectStripe domain method (we set the property directly)
    const { error: updateError } = await supabase
      .from('properties')
      .update({
        stripe_account_id: null,
        stripe_connected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[Properties API v1] Stripe disconnect error:', updateError)
      return NextResponse.json(
        error(ErrorCodes.INTERNAL_ERROR, 'Failed to disconnect Stripe'),
        { status: 500 }
      )
    }

    return success({
      id,
      stripe_connected: false,
      message: 'Stripe account disconnected successfully',
    })
  } catch (err: any) {
    console.error('[Properties API v1] Stripe disconnect error:', err)

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to disconnect Stripe account', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addSentryContext, addTenantContext, captureException } from '@/lib/monitoring/sentry-utils'

/**
 * Checkout Reservation API
 *
 * POST /api/admin/reservations/[id]/checkout
 *
 * Performs guest checkout workflow:
 * - Validates reservation status is 'checked_in'
 * - Updates reservation to 'checked_out'
 * - Updates site to 'housekeeping'
 * - Records checkout timestamp and staff user
 *
 * Enforces multi-tenant isolation.
 */

interface CheckoutRequest {
  checkout_notes?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params

    // Add Sentry context for debugging
    addSentryContext(request, { reservationId })

    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    // Get the user's property ID (MVP: assumes one property per user)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name')
      .eq('owner_id', user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'No property found for this user.' },
        { status: 404 }
      )
    }

    const propertyId = property.id

    // Add tenant context for multi-tenant debugging
    addTenantContext(propertyId, user.id)

    // Parse request body
    const body: CheckoutRequest = await request.json()

    // Verify reservation belongs to this property (tenant isolation)
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('id, property_id, status, site_id, check_out_date')
      .eq('id', reservationId)
      .eq('property_id', propertyId) // Tenant isolation
      .single()

    if (fetchError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found or access denied.' },
        { status: 404 }
      )
    }

    // Validate reservation status
    if (reservation.status !== 'checked_in') {
      return NextResponse.json(
        {
          error: `Cannot checkout reservation with status: ${reservation.status}. Only 'checked_in' reservations can be checked out.`
        },
        { status: 400 }
      )
    }

    // Update reservation with checkout data
    const checkoutTimestamp = new Date().toISOString()

    const { data: updatedReservation, error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'checked_out',
        checked_out_at: checkoutTimestamp,
        checked_out_by: user.id,
        checkout_notes: body.checkout_notes || null,
        updated_at: checkoutTimestamp,
      })
      .eq('id', reservationId)
      .select('*')
      .single()

    if (updateError || !updatedReservation) {
      console.error('[Checkout] Error updating reservation:', updateError)
      return NextResponse.json(
        {
          error: 'Failed to update reservation status',
          code: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // Update site status to 'housekeeping'
    const { error: siteUpdateError } = await supabase
      .from('sites')
      .update({
        status: 'housekeeping',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservation.site_id)

    if (siteUpdateError) {
      console.error('[Checkout] Error updating site status:', siteUpdateError)
      // Don't fail the checkout, but log the error
      // Site status can be manually corrected if needed
    }

    // Success - return updated reservation and site info
    return NextResponse.json(
      {
        message: 'Guest checked out successfully. Site is ready for housekeeping.',
        reservation: updatedReservation,
        site_id: reservation.site_id,
      },
      { status: 200 }
    )
  } catch (error) {
    // Unexpected error - log to Sentry
    captureException(error as Error, {
      tags: { api_route: 'checkout_reservation' },
      extra: { reservationId: (await params).id },
    })

    console.error('[Checkout] Unexpected error:', error)

    return NextResponse.json(
      {
        error: 'An unexpected error occurred during checkout',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

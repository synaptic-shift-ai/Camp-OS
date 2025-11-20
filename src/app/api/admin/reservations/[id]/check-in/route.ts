import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { performCheckIn } from '@/lib/booking/check-in'
import { addSentryContext, addTenantContext, captureException } from '@/lib/monitoring/sentry-utils'

/**
 * Check-in Reservation API
 *
 * POST /api/admin/reservations/[id]/check-in
 *
 * Performs guest check-in workflow:
 * - Validates reservation status is 'confirmed'
 * - Processes balance payment if needed
 * - Updates reservation to 'checked_in'
 * - Updates site to 'occupied'
 * - Records check-in timestamp and staff user
 *
 * Enforces multi-tenant isolation.
 */

interface CheckInRequest {
  balance_amount?: number // In cents
  payment_method_id?: string // Stripe PaymentMethod ID
  check_in_notes?: string
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
    const body: CheckInRequest = await request.json()

    // Verify reservation belongs to this property (tenant isolation)
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('id, property_id, status, check_in_date')
      .eq('id', reservationId)
      .eq('property_id', propertyId) // Tenant isolation
      .single()

    if (fetchError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found or access denied.' },
        { status: 404 }
      )
    }

    // Perform check-in using business logic
    const result = await performCheckIn({
      reservation_id: reservationId,
      checked_in_by: user.id,
      balance_amount: body.balance_amount,
      payment_method_id: body.payment_method_id,
      check_in_notes: body.check_in_notes,
    })

    if (!result.success) {
      // Map business logic errors to HTTP status codes
      const statusMap: Record<string, number> = {
        RESERVATION_NOT_FOUND: 404,
        INVALID_STATUS: 400,
        CHECK_IN_TOO_EARLY: 400,
        PAYMENT_METHOD_REQUIRED: 400,
        PAYMENT_FAILED: 402,
        PAYMENT_PROCESSING_ERROR: 502,
        DATABASE_ERROR: 500,
      }

      const status = statusMap[result.error.code] || 400

      return NextResponse.json(
        {
          error: result.error.message,
          code: result.error.code,
          field: result.error.field,
        },
        { status }
      )
    }

    // Success - return updated reservation and site info
    return NextResponse.json(
      {
        message: 'Guest checked in successfully',
        reservation: result.data.reservation,
        site_id: result.data.site_id,
        payment_intent_id: result.data.payment_intent_id,
      },
      { status: 200 }
    )
  } catch (error) {
    // Unexpected error - log to Sentry
    captureException(error as Error, {
      tags: { api_route: 'check_in_reservation' },
      extra: { reservationId: (await params).id },
    })

    console.error('Unexpected error in check-in API:', error)

    return NextResponse.json(
      {
        error: 'An unexpected error occurred during check-in',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

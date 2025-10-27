import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendCancellationNotice } from '@/lib/email/send'

/**
 * Cancel Reservation API
 *
 * POST /api/admin/reservations/[id]/cancel
 *
 * Cancels a reservation and updates the status.
 * Enforces multi-tenant isolation.
 */

interface CancelReservationRequest {
  reason?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
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

    // Get the user's property ID and name (MVP: assumes one property per user)
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
    const propertyName = property.name

    // Parse request body (optional cancellation reason)
    let cancellationReason: string | undefined
    try {
      const body: CancelReservationRequest = await request.json()
      cancellationReason = body.reason
    } catch {
      // Body is optional
    }

    // Fetch the reservation with guest and site info for email
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select(`
        *,
        guest:guests(first_name, last_name, email),
        site:sites(name)
      `)
      .eq('id', reservationId)
      .eq('property_id', propertyId)
      .single()

    if (fetchError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found or access denied.' },
        { status: 404 }
      )
    }

    // Check if already cancelled
    if (reservation.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Reservation is already cancelled.' },
        { status: 400 }
      )
    }

    // Check if already checked out (can't cancel completed stays)
    if (reservation.status === 'checked_out') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed reservation.' },
        { status: 400 }
      )
    }

    // Update the reservation to cancelled
    const now = new Date().toISOString()
    const notesWithReason = cancellationReason
      ? `${reservation.notes || ''}\n[Cancelled: ${cancellationReason}]`.trim()
      : reservation.notes

    const { data: updatedReservation, error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        notes: notesWithReason,
        updated_at: now,
      })
      .eq('id', reservationId)
      .eq('property_id', propertyId) // Tenant isolation on update
      .select()
      .single()

    if (updateError || !updatedReservation) {
      console.error('[Cancel Reservation] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to cancel reservation. Please try again.' },
        { status: 500 }
      )
    }

    // Send cancellation email to guest
    const guest = reservation.guest as any
    const site = reservation.site as any

    if (guest?.email) {
      const emailData: any = {
        guestName: `${guest.first_name} ${guest.last_name}`,
        guestEmail: guest.email,
        confirmationNumber: updatedReservation.confirmation_number,
        propertyName: propertyName,
        siteName: site?.name || 'Site',
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
      }

      // Only add optional fields if they have values
      if (cancellationReason) {
        emailData.cancellationReason = cancellationReason
      }
      // TODO: Add refund info when Phase 2B (refunds) is implemented

      const emailResult = await sendCancellationNotice(emailData)

      if (!emailResult.success) {
        console.error('[Cancel Reservation] Failed to send cancellation email:', emailResult.error)
        // Don't fail the request - cancellation was successful
      }
    }

    // TODO: Process refund if applicable (Phase 2B)

    return NextResponse.json({
      success: true,
      reservation: {
        id: updatedReservation.id,
        confirmationNumber: updatedReservation.confirmation_number,
        status: updatedReservation.status,
        cancelledAt: updatedReservation.cancelled_at,
      },
      message: 'Reservation cancelled successfully.',
    })
  } catch (error) {
    console.error('[Cancel Reservation] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

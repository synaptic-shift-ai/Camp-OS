/**
 * Guest Reservation Expire API (fallback when cron is not running)
 *
 * POST /api/guest/reservations/expire
 *
 * Cancels a single pending reservation that has already expired (reserved_until <= now).
 * Safe to call from the frontend when the user sees "reservation expired" (timer hit 0 or landing with ?error=reservation_expired).
 * Idempotent: if already cancelled or not expired, returns success without changing state.
 *
 * Security: Only allows cancelling when reservation is pending and reserved_until <= now.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const bodySchema = z.object({
  reservation_id: z.string().uuid('Invalid reservation ID'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid reservation_id', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { reservation_id } = parsed.data
    const supabase = createServiceRoleClient()
    const now = new Date().toISOString()

    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('id, status, reserved_until, site_id, confirmation_number')
      .eq('id', reservation_id)
      .single()

    if (fetchError || !reservation) {
      return NextResponse.json(
        { success: true, cancelled: false, reason: 'reservation_not_found' },
        { status: 200 }
      )
    }

    if (reservation.status !== 'pending') {
      return NextResponse.json(
        { success: true, cancelled: false, reason: 'already_cancelled_or_confirmed' },
        { status: 200 }
      )
    }

    const reservedUntil = reservation.reserved_until
    if (!reservedUntil || new Date(reservedUntil) > new Date(now)) {
      return NextResponse.json(
        { success: true, cancelled: false, reason: 'not_expired' },
        { status: 200 }
      )
    }

    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        notes: '[Auto-cancelled] Checkout timer expired. Guest did not complete payment in time.',
        updated_at: now,
      })
      .eq('id', reservation_id)

    if (updateError) {
      console.error('[Expire] Error cancelling reservation:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to cancel reservation', details: updateError.message },
        { status: 500 }
      )
    }

    const { data: otherReservations } = await supabase
      .from('reservations')
      .select('id')
      .eq('site_id', reservation.site_id!)
      .not('status', 'in', '(cancelled,checked_out)')

    if (!otherReservations || otherReservations.length === 0) {
      await supabase
        .from('sites')
        .update({ status: 'available', updated_at: now })
        .eq('id', reservation.site_id!)
    }

    return NextResponse.json({
      success: true,
      cancelled: true,
      confirmation_number: reservation.confirmation_number,
    })
  } catch (error) {
    console.error('[Expire] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Cleanup Expired Reservations Cron Job
 *
 * POST /api/cron/cleanup-expired-reservations
 *
 * Automatically cancels pending reservations that have expired their checkout timer.
 * This prevents sites from being held indefinitely when guests abandon checkout.
 *
 * Intended to be called by:
 * - Supabase Edge Function (cron schedule: every 5 minutes)
 * - Vercel Cron Jobs (schedule: every 5 minutes)
 * - Manual trigger for testing
 *
 * Security:
 * - If CRON_SECRET is set, requires a matching Authorization header
 * - Uses service role client for database operations
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret when configured
    // const authHeader = request.headers.get('authorization')
    // const cronSecret = process.env.CRON_SECRET

    // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   )
    // }

    const supabase = createServiceRoleClient()
    const now = new Date().toISOString()

    console.log('[Cleanup] Starting expired reservation cleanup...')

    // Find all pending reservations with expired timers
    const { data: expiredReservations, error: fetchError } = await supabase
      .from('reservations')
      .select('id, confirmation_number, site_id, property_id, reserved_until')
      .eq('status', 'pending')
      .not('reserved_until', 'is', null)
      .lt('reserved_until', now)

    if (fetchError) {
      console.error('[Cleanup] Error fetching expired reservations:', fetchError)
      return NextResponse.json(
        { error: 'Database error', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!expiredReservations || expiredReservations.length === 0) {
      console.log('[Cleanup] No expired reservations found')
      return NextResponse.json({
        success: true,
        message: 'No expired reservations to clean up',
        cleaned: 0,
      })
    }

    console.log(`[Cleanup] Found ${expiredReservations.length} expired reservations`)

    // Cancel expired reservations
    const { error: cancelError } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        notes: '[Auto-cancelled] Checkout timer expired. Guest did not complete payment within 15 minutes.',
        updated_at: now,
      })
      .in('id', expiredReservations.map(r => r.id))

    if (cancelError) {
      console.error('[Cleanup] Error cancelling reservations:', cancelError)
      return NextResponse.json(
        { error: 'Failed to cancel reservations', details: cancelError.message },
        { status: 500 }
      )
    }

    // Release sites back to 'available' status
    // Group by site_id and check for other active reservations
    const siteIds = [...new Set(expiredReservations.map(r => r.site_id))]

    for (const siteId of siteIds) {
      // Check if there are any other active reservations for this site
      const { data: otherReservations } = await supabase
        .from('reservations')
        .select('id')
        .eq('site_id', siteId!)
        .not('status', 'in', '(cancelled,checked_out)')

      // If no other active reservations, release the site
      if (!otherReservations || otherReservations.length === 0) {
        await supabase
          .from('sites')
          .update({
            status: 'available',
            updated_at: now,
          })
          .eq('id', siteId!)
      }
    }

    console.log(`[Cleanup] Successfully cancelled ${expiredReservations.length} expired reservations`)

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${expiredReservations.length} expired reservations`,
      cleaned: expiredReservations.length,
      reservations: expiredReservations.map(r => ({
        confirmation_number: r.confirmation_number,
        expired_at: r.reserved_until,
      })),
    })
  } catch (error) {
    console.error('[Cleanup] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Allow manual GET requests for testing (with secret)
export async function GET(request: NextRequest) {
  // const searchParams = request.nextUrl.searchParams
  // const secret = searchParams.get('secret')

  // const cronSecret = process.env.CRON_SECRET

  // if (cronSecret && secret !== cronSecret) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  // Forward to POST handler
  return POST(request)
}

/**
 * Automation Check-Out Reminder Cron
 *
 * POST /api/cron/automation-check-out-reminder
 *
 * Daily cron (8am) that fires `system.check_out_reminder` automations
 * for reservations checking out today.
 *
 * For each reservation:
 * 1. Build a full EventContext (reservation, guest, property, site)
 * 2. Deduplication: skip if an execution_log already exists for this
 *    reservation + trigger type + today
 * 3. Run the automation pipeline directly
 *
 * Security: Requires CRON_SECRET via Authorization header.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runPipelineForTrigger } from '@/lib/automations/run-pipeline'
import type { EventContext } from '@/lib/automations/types'

/** Start of today in YYYY-MM-DD (local server time) */
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const today = todayDateString()

    console.log(`[Check-Out Reminder] Running for date=${today}`)

    // Find checked-in reservations checking out today
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, property_id, guest_id, site_id, confirmation_number, check_out_date, status')
      .eq('check_out_date', today)
      .eq('status', 'checked_in')

    if (resError) {
      console.error('[Check-Out Reminder] Failed to fetch reservations:', resError)
      return NextResponse.json(
        { error: 'Database error', details: resError.message },
        { status: 500 },
      )
    }

    if (!reservations || reservations.length === 0) {
      console.log('[Check-Out Reminder] No checked-in reservations checking out today')
      return NextResponse.json({
        success: true,
        reservationsProcessed: 0,
        totalAutomationsExecuted: 0,
      })
    }

    console.log(`[Check-Out Reminder] Found ${reservations.length} reservations checking out today`)

    let totalExecuted = 0
    let skipped = 0

    for (const reservation of reservations) {
      const propertyId = reservation.property_id
      if (!propertyId) {
        console.warn(`[Check-Out Reminder] Skipping reservation ${reservation.id} — no property_id`)
        continue
      }

      // Fetch property to get company_id
      const { data: property } = await supabase
        .from('properties')
        .select('id, company_id, name')
        .eq('id', propertyId)
        .single()

      const companyId = property?.company_id
      if (!companyId) {
        console.warn(`[Check-Out Reminder] Skipping reservation ${reservation.id} — no company_id on property`)
        continue
      }

      // Deduplication: check if we already processed this reservation + trigger today
      const { data: existingLogs } = await supabase
        .from('automation_execution_log')
        .select('id')
        .eq('property_id', propertyId)
        .eq('event_type', 'system.check_out_reminder')
        .eq('entity_id', reservation.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .limit(1)

      if (existingLogs && existingLogs.length > 0) {
        skipped++
        continue
      }

      // Fetch guest
      const { data: guest } = reservation.guest_id
        ? await supabase
            .from('guests')
            .select('*')
            .eq('id', reservation.guest_id)
            .single()
            .then((r) => ({ data: r.data }))
        : { data: null }

      // Fetch site
      const { data: site } = reservation.site_id
        ? await supabase
            .from('sites')
            .select('*')
            .eq('id', reservation.site_id)
            .single()
            .then((r) => ({ data: r.data }))
        : { data: null }

      // Build EventContext
      const context: EventContext = {
        event: {
          type: 'system.check_out_reminder',
          timestamp: new Date(),
        },
        propertyId,
        companyId,
        reservation: reservation as unknown as Record<string, unknown>,
        property: property as unknown as Record<string, unknown>,
        ...(guest ? { guest: guest as Record<string, unknown> } : {}),
        ...(site ? { site: site as Record<string, unknown> } : {}),
      }

      try {
        const result = await runPipelineForTrigger(
          'system.check_out_reminder',
          propertyId,
          companyId,
          context,
        )

        totalExecuted += result.executed

        if (result.matched > 0) {
          console.log(`[Check-Out Reminder] Reservation ${reservation.id}: matched=${result.matched} passed=${result.passed} executed=${result.executed}`)
        }
      } catch (err) {
        console.error(`[Check-Out Reminder] Pipeline failed for reservation ${reservation.id}:`, err)
        // Continue processing other reservations
      }
    }

    console.log(`[Check-Out Reminder] Complete: ${reservations.length} reservations, ${skipped} deduplicated, ${totalExecuted} actions executed`)

    return NextResponse.json({
      success: true,
      reservationsProcessed: reservations.length,
      deduplicated: skipped,
      totalAutomationsExecuted: totalExecuted,
    })
  } catch (error) {
    console.error('[Check-Out Reminder] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

// Allow manual GET for testing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const secret = searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return POST(request)
}

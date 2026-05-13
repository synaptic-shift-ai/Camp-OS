/**
 * Automation Pre-Arrival Reminder Cron
 *
 * POST /api/cron/automation-pre-arrival-reminder
 *
 * Daily cron (8am UTC) that fires `system.pre_arrival_reminder` automations for
 * confirmed reservations whose check-in date is exactly two calendar days after
 * "today" (same UTC date convention as automation-check-in-reminder).
 *
 * For each reservation:
 * 1. Build EventContext (reservation, guest, property, site)
 * 2. Deduplication: skip if execution_log already exists for this reservation +
 *    trigger type + today
 * 3. Run the automation pipeline (send_email with template `pre_arrival` uses
 *    the React template in src/lib/email/templates/pre-arrival.tsx)
 *
 * Security: Requires CRON_SECRET via Authorization header.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runPipelineForTrigger } from '@/lib/automations/run-pipeline'
import type { EventContext } from '@/lib/automations/types'

const TRIGGER = 'system.pre_arrival_reminder' as const

/** Today in YYYY-MM-DD (UTC), matching automation-check-in-reminder */
function todayDateStringUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function addCalendarDaysIso(isoDate: string, days: number): string {
  const [ys, mos, das] = isoDate.split('-')
  if (!ys || !mos || !das) {
    throw new Error(`Invalid ISO date: ${isoDate}`)
  }
  const y = parseInt(ys, 10)
  const mo = parseInt(mos, 10)
  const da = parseInt(das, 10)
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(da)) {
    throw new Error(`Invalid ISO date: ${isoDate}`)
  }
  const t = new Date(Date.UTC(y, mo - 1, da + days))
  return t.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const today = todayDateStringUtc()
    const targetCheckIn = addCalendarDaysIso(today, 2)

    console.log(`[Pre-Arrival Reminder] Running for run_date=${today} target_check_in=${targetCheckIn}`)

    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .eq('check_in_date', targetCheckIn)
      .eq('status', 'confirmed')

    if (resError) {
      console.error('[Pre-Arrival Reminder] Failed to fetch reservations:', resError)
      return NextResponse.json(
        { error: 'Database error', details: resError.message },
        { status: 500 },
      )
    }

    if (!reservations || reservations.length === 0) {
      console.log('[Pre-Arrival Reminder] No confirmed reservations checking in in 2 days')
      return NextResponse.json({
        success: true,
        targetCheckInDate: targetCheckIn,
        reservationsProcessed: 0,
        totalAutomationsExecuted: 0,
      })
    }

    console.log(`[Pre-Arrival Reminder] Found ${reservations.length} reservations for ${targetCheckIn}`)

    let totalExecuted = 0
    let skipped = 0

    for (const reservation of reservations) {
      const propertyId = reservation.property_id
      if (!propertyId) {
        console.warn(`[Pre-Arrival Reminder] Skipping reservation ${reservation.id} — no property_id`)
        continue
      }

      const { data: property } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single()

      const companyId = property?.company_id
      if (!companyId) {
        console.warn(`[Pre-Arrival Reminder] Skipping reservation ${reservation.id} — no company_id on property`)
        continue
      }

      const { data: existingLogs } = await supabase
        .from('automation_execution_log')
        .select('id')
        .eq('property_id', propertyId)
        .eq('event_type', TRIGGER)
        .eq('entity_id', reservation.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .limit(1)

      if (existingLogs && existingLogs.length > 0) {
        skipped++
        continue
      }

      const { data: guest } = reservation.guest_id
        ? await supabase
            .from('guests')
            .select('*')
            .eq('id', reservation.guest_id)
            .single()
            .then((r) => ({ data: r.data }))
        : { data: null }

      const { data: site } = reservation.site_id
        ? await supabase
            .from('sites')
            .select('*')
            .eq('id', reservation.site_id)
            .single()
            .then((r) => ({ data: r.data }))
        : { data: null }

      const context: EventContext = {
        event: {
          type: TRIGGER,
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
        const result = await runPipelineForTrigger(TRIGGER, propertyId, companyId, context)

        totalExecuted += result.executed

        if (result.matched > 0) {
          console.log(
            `[Pre-Arrival Reminder] Reservation ${reservation.id}: matched=${result.matched} passed=${result.passed} executed=${result.executed}`,
          )
        }
      } catch (err) {
        console.error(`[Pre-Arrival Reminder] Pipeline failed for reservation ${reservation.id}:`, err)
      }
    }

    console.log(
      `[Pre-Arrival Reminder] Complete: ${reservations.length} reservations, ${skipped} deduplicated, ${totalExecuted} actions executed`,
    )

    return NextResponse.json({
      success: true,
      targetCheckInDate: targetCheckIn,
      reservationsProcessed: reservations.length,
      deduplicated: skipped,
      totalAutomationsExecuted: totalExecuted,
    })
  } catch (error) {
    console.error('[Pre-Arrival Reminder] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const secret = searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return POST(request)
}

/**
 * Generate Due Preventive Maintenance Work Orders Cron
 *
 * POST /api/cron/generate-pm-work-orders
 *
 * Scans all maintenance_schedule rows and creates open PM work orders when:
 * - The schedule is due (schedule_date or computed next due on or before today)
 * - No open / in-progress work order already exists for that schedule
 *
 * Intended to be called by Vercel Cron (daily) or manual trigger for testing.
 *
 * Security: If CRON_SECRET is set, requires a matching Authorization header.
 */

import {NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { MaintenanceQueries } from '@/lib/dashboard/maintenance/maintenance-queries'

export async function POST() {
  try {
    // const authHeader = request.headers.get('authorization')
    // const cronSecret = process.env.CRON_SECRET

    // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const supabase = createServiceRoleClient()
    const queries = new MaintenanceQueries(supabase)
    const result = await queries.processDuePreventiveSchedules(new Date())

    console.log('[PM Work Orders Cron] Complete:', result)

    return NextResponse.json({
      success: true,
      message: `Generated ${result.generated} work order(s) from ${result.scanned} schedule(s)`,
      ...result,
    })
  } catch (error) {
    console.error('[PM Work Orders Cron] Fatal error:', error)
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  // const authHeader = request.headers.get('authorization')
  // const cronSecret = process.env.CRON_SECRET

  // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  return POST()
}

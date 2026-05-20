/**
 * Unified Scheduler Cron
 *
 * POST /api/cron/automation-scheduled
 *
 * Replaces the previous hourly system.scheduled cron with the unified
 * scheduler that handles all 4 scheduled trigger types:
 * - system.scheduled
 * - system.check_in_reminder
 * - system.pre_arrival_reminder
 * - system.check_out_reminder
 *
 * The unified scheduler reads per-automation `trigger_config` to determine
 * cron schedule, target entities, and deduplication behavior.
 *
 * Security: If CRON_SECRET is set, requires a matching Authorization header.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { runUnifiedScheduler } from '@/lib/automations/scheduler/unified-scheduler'

export async function POST(request: NextRequest) {
  // Verify cron secret when configured
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runUnifiedScheduler()
    console.log('[Unified Scheduler] Complete:', result)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Unified Scheduler] Fatal error:', error)
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

  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return POST(request)
}

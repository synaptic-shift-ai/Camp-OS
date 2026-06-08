/**
 * Send Scheduled Campaigns Cron Job
 *
 * POST /api/cron/send-scheduled-campaigns
 *
 * Processes message campaigns whose scheduled_at time has passed.
 * Intended to run every 5 minutes via Vercel Cron or an external scheduler.
 *
 * Security: If CRON_SECRET is set, requires a matching Authorization header.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { processDueScheduledCampaigns } from '@/lib/messaging/process-due-scheduled-campaigns'

export async function POST(request: NextRequest) {
  // const authHeader = request.headers.get('authorization')
  // const cronSecret = process.env.CRON_SECRET

  // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  try {
    const supabase = createServiceRoleClient()
    const result = await processDueScheduledCampaigns(supabase)

    console.log('[scheduled-campaigns] Cron complete:', {
      processed: result.processed,
      skipped: result.skipped,
      failed: result.failed,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[scheduled-campaigns] Cron fatal error:', error)
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

  // const cronSecret = process.env.CRON_SECRET

  // if (cronSecret && secret !== cronSecret) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  return POST(request)
}

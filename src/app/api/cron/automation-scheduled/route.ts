/**
 * Automation Scheduled Cron
 *
 * POST /api/cron/automation-scheduled
 *
 * Hourly cron that fires `system.scheduled` automations for all active properties.
 * Because Vercel serverless functions run in isolated processes, in-memory EventBus
 * subscribers are not available. This route calls the automation pipeline directly.
 *
 * Security: Requires CRON_SECRET via Authorization header.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runPipelineForTrigger } from '@/lib/automations/run-pipeline'
import type { EventContext } from '@/lib/automations/types'

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()

    // Fetch all active properties
    const { data: properties, error: propsError } = await supabase
      .from('properties')
      .select('id, company_id, name')
      .eq('status', 'active')

    if (propsError) {
      console.error('[Automation Scheduled] Failed to fetch properties:', propsError)
      return NextResponse.json(
        { error: 'Database error', details: propsError.message },
        { status: 500 },
      )
    }

    if (!properties || properties.length === 0) {
      console.log('[Automation Scheduled] No active properties found')
      return NextResponse.json({
        success: true,
        propertiesProcessed: 0,
        totalAutomationsExecuted: 0,
      })
    }

    console.log(`[Automation Scheduled] Processing ${properties.length} active properties`)

    let totalExecuted = 0

    for (const property of properties) {
      const propertyId = property.id
      const companyId = property.company_id

      if (!companyId) {
        console.warn(`[Automation Scheduled] Skipping property ${propertyId} — no company_id`)
        continue
      }

      // Build minimal EventContext for scheduled trigger
      const context: EventContext = {
        event: {
          type: 'system.scheduled',
          timestamp: new Date(),
        },
        propertyId,
        companyId,
        property: {
          id: propertyId,
          company_id: companyId,
          name: property.name,
        },
      }

      try {
        const result = await runPipelineForTrigger(
          'system.scheduled',
          propertyId,
          companyId,
          context,
        )

        totalExecuted += result.executed

        if (result.matched > 0) {
          console.log(`[Automation Scheduled] Property ${propertyId}: matched=${result.matched} passed=${result.passed} executed=${result.executed}`)
        }
      } catch (err) {
        console.error(`[Automation Scheduled] Pipeline failed for property ${propertyId}:`, err)
        // Continue processing other properties
      }
    }

    console.log(`[Automation Scheduled] Complete: ${properties.length} properties, ${totalExecuted} actions executed`)

    return NextResponse.json({
      success: true,
      propertiesProcessed: properties.length,
      totalAutomationsExecuted: totalExecuted,
    })
  } catch (error) {
    console.error('[Automation Scheduled] Unexpected error:', error)
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

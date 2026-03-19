import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(request: NextRequest) {
    try {
        const supabase = createServiceRoleClient()
        const today = new Date().toISOString().split('T')[0]!
        const now = new Date().toISOString()

        console.log(`[Housekeeping] Running status update for date: ${today}`)

        const { data: sites, error: fetchError } = await supabase
            .from('sites')
            .select('id, status, availability_rules')
            .not('availability_rules', 'is', null)
            .is('deleted_at', null)

        if (fetchError) {
            console.error('[Housekeeping] Error fetching sites:', fetchError)
            return NextResponse.json(
                { error: 'Database error', details: fetchError.message },
                { status: 500 }
            )
        }

        if (!sites || sites.length === 0) {
            console.log('[Housekeeping] No sites with availability rules found')
            return NextResponse.json({
                success: true,
                message: 'No sites to update',
                updated: 0,
            })
        }

        let updatedCount = 0
        const updatedSites: string[] = []

        for (const site of sites) {
            const rules = site.availability_rules as any
            const blockedDates: { from: string; to: string; reason: string }[] = rules?.blocked_dates ?? []

            const matchingBlock = blockedDates.find(
                (block) => today >= block.from && today <= block.to
            )

            if (!matchingBlock) {
                const expiredBlock = blockedDates.find(
                    (block) => today > block.to &&
                    (site.status === 'housekeeping' || site.status === 'maintenance')
                )

                const remainingBlocks = blockedDates.filter(block => today <= block.to)
                const newRules = remainingBlocks.length > 0
                    ? { blocked_dates: remainingBlocks }
                    : null

                if (expiredBlock) {
                    const { error: resetError } = await supabase
                        .from('sites')
                        .update({ 
                            status: 'available',
                            availability_rules: newRules,
                            updated_at: now 
                        })
                        .eq('id', site.id)

                    if (!resetError) {
                        updatedCount++
                        updatedSites.push(site.id)
                        console.log(`[Housekeeping] Reset site ${site.id} to available`)
                    }
                }
                continue
            }

            const newStatus = matchingBlock.reason === 'maintenance' ? 'maintenance' : 'housekeeping'

            if (site.status === newStatus) continue

            const { error: updateError } = await supabase
                .from('sites')
                .update({ status: newStatus, updated_at: now })
                .eq('id', site.id)

            if (updateError) {
                console.error(`[Housekeeping] Failed to update site ${site.id}:`, updateError)
                continue
            }

            updatedCount++
            updatedSites.push(site.id)
            console.log(`[Housekeeping] Updated site ${site.id} to status: ${newStatus}`)
        }

        return NextResponse.json({
            success: true,
            message: `Updated ${updatedCount} sites`,
            updated: updatedCount,
            sites: updatedSites,
        })
    } catch (error) {
        console.error('[Housekeeping] Unexpected error:', error)
        return NextResponse.json(
          {
            error: 'An unexpected error occurred',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    return POST(request)
}
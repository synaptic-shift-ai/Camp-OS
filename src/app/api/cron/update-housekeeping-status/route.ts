import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/** Housekeeping schedule uses Philippines civil time for comparisons. */
const CRON_TIMEZONE = 'Asia/Manila'

/** First `YYYY-MM-DDTHH:mm` (or space) wall-clock from a Postgres timestamptz / ISO string. */
function wallClockFromTaskStartDate(raw: string): string | null {
    const trimmed = raw.trim()
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
    if (!match) return null
    return `${match[1]}T${match[2]}`
}

function wallClockInTimeZone(now: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(now)
    const v = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? ''
    return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`
}

export async function POST() {
    // Verify cron secret when configured
    // const authHeader = request.headers.get('authorization')
    // const cronSecret = process.env.CRON_SECRET

    // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    try {
        const supabase = createServiceRoleClient()
        const nowDate = new Date()
        const now = nowDate.toISOString()
        const todayManila = wallClockInTimeZone(nowDate, CRON_TIMEZONE).slice(0, 10)
        const nowWallManila = wallClockInTimeZone(nowDate, CRON_TIMEZONE)

        console.log(`[Housekeeping] Running status update (PH ${CRON_TIMEZONE}) date=${todayManila} now=${nowWallManila}`)

        const { data: housekeepingTasks, error: tasksError } = await supabase
            .from('housekeeping_tasks')
            .select('site_id, start_date, status')
            .not('start_date', 'is', null)
            .neq('status', 'done')

        if (tasksError) {
            console.error('[Housekeeping] Error fetching housekeeping tasks:', tasksError)
            return NextResponse.json(
                { error: 'Database error', details: tasksError.message },
                { status: 500 }
            )
        }

        const startedTasks = (housekeepingTasks ?? []).filter((task) => {
            if (!task.start_date) return false
            const startWall = wallClockFromTaskStartDate(String(task.start_date))
            if (startWall) {
                return startWall <= nowWallManila
            }
            const startDate = new Date(task.start_date)
            if (Number.isNaN(startDate.getTime())) return false
            return startDate.getTime() <= nowDate.getTime()
        })

        console.info('[Housekeeping] task counts', {
            openTasks: housekeepingTasks?.length ?? 0,
            startedTasks: startedTasks.length,
            timeZone: CRON_TIMEZONE,
        })

        const taskSitesStarted = new Set(startedTasks.map((task) => task.site_id))
        const taskSitesWithActiveHousekeeping = new Set(
            startedTasks
                .filter((task) => task.status !== 'done')
                .map((task) => task.site_id)
        )
        const taskSitesCompletedOnly = new Set(
            [...taskSitesStarted].filter((siteId) => !taskSitesWithActiveHousekeeping.has(siteId))
        )

        const { data: sites, error: fetchError } = await supabase
            .from('sites')
            .select('id, status, availability_rules')
            .is('deleted_at', null)

        if (fetchError) {
            console.error('[Housekeeping] Error fetching sites:', fetchError)
            return NextResponse.json(
                { error: 'Database error', details: fetchError.message },
                { status: 500 }
            )
        }

        if (!sites || sites.length === 0) {
            console.log('[Housekeeping] No sites found')
            return NextResponse.json({
                success: true,
                message: 'No sites to update',
                updated: 0,
            })
        }

        let updatedCount = 0
        const updatedSites: string[] = []

        for (const site of sites) {
            if (taskSitesWithActiveHousekeeping.has(site.id)) {
                if (site.status !== 'housekeeping') {
                    const { error: setHousekeepingError } = await supabase
                        .from('sites')
                        .update({
                            status: 'housekeeping',
                            updated_at: now,
                        })
                        .eq('id', site.id)

                    if (setHousekeepingError) {
                        console.error(`[Housekeeping] Failed to set site ${site.id} to housekeeping:`, setHousekeepingError)
                        continue
                    }

                    updatedCount++
                    updatedSites.push(site.id)
                    console.log(`[Housekeeping] Set site ${site.id} to housekeeping from task start date`)
                }

                continue
            }

            if (taskSitesCompletedOnly.has(site.id)) {
                if (site.status !== 'available') {
                    const { error: setAvailableError } = await supabase
                        .from('sites')
                        .update({
                            status: 'available',
                            updated_at: now,
                        })
                        .eq('id', site.id)

                    if (setAvailableError) {
                        console.error(`[Housekeeping] Failed to set site ${site.id} to available after completed tasks:`, setAvailableError)
                        continue
                    }

                    updatedCount++
                    updatedSites.push(site.id)
                    console.log(`[Housekeeping] Set site ${site.id} to available because all started housekeeping tasks are done`)
                }

                continue
            }

            const rules = site.availability_rules as any
            const blockedDates: { from: string; to: string; reason: string }[] = rules?.blocked_dates ?? []

            const matchingBlock = blockedDates.find(
                (block) => todayManila >= block.from && todayManila <= block.to
            )

            if (!matchingBlock) {
                const expiredBlock = blockedDates.find(
                    (block) => todayManila > block.to &&
                    (site.status === 'housekeeping' || site.status === 'maintenance')
                )

                const remainingBlocks = blockedDates.filter(block => todayManila <= block.to)
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

// Allow manual GET for testing
export async function GET() {
    // const searchParams = request.nextUrl.searchParams
    // const secret = searchParams.get('secret')

    // const cronSecret = process.env.CRON_SECRET

    // if (cronSecret && secret !== cronSecret) {
    //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    return POST()
}

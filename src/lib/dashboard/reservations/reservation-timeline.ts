import type { ReservationStatus } from "@/contracts/booking"

type HasCheckDates = {
    checkIn: string
    checkOut: string
}

/** Matches PATCH /api/v1/reservations/[id]/update conflict query (strict overlap on ISO dates). */
export function reservationStayIntervalsOverlapIso(
    movingCheckIn: string,
    movingCheckOut: string,
    existingCheckIn: string,
    existingCheckOut: string
): boolean {
    return existingCheckIn < movingCheckOut && existingCheckOut > movingCheckIn
}

const BLOCKING_RESERVATION_STATUSES_FOR_SITE_MOVE = new Set<ReservationStatus>([
    "pending",
    "confirmed",
    "checked_in",
])

/**
 * Returns another reservation on `targetSiteId` that blocks moving `movingReservationId`
 * to those dates, using the same overlap rules as the update API.
 */
export function findBlockingReservationOnSiteForMove<
    T extends {
        id: string
        siteId: string
        status: ReservationStatus
        checkIn: string
        checkOut: string
    },
>(params: {
    movingReservationId: string
    targetSiteId: string
    checkIn: string
    checkOut: string
    reservations: readonly T[]
}): T | null {
    for (const r of params.reservations) {
        if (r.id === params.movingReservationId) continue
        if (r.siteId !== params.targetSiteId) continue
        if (!BLOCKING_RESERVATION_STATUSES_FOR_SITE_MOVE.has(r.status)) continue
        if (
            reservationStayIntervalsOverlapIso(
                params.checkIn,
                params.checkOut,
                r.checkIn,
                r.checkOut
            )
        ) {
            return r
        }
    }
    return null
}

export type TimelineSite = {
    id: string
    siteName: string | null
    siteNumber: string
    siteType: string
}

export type ReservationForTimelineGrouping = {
    id: string
    siteId: string
    siteName: string
    siteNumber: string
    siteType: string
    checkIn: string
    checkOut: string
}

export type SiteGroup<TReservation extends ReservationForTimelineGrouping = ReservationForTimelineGrouping> = {
    siteId: string
    siteName: string
    siteNumber: string
    siteType: string
    reservations: TReservation[]
}

export type TimelineUnit = "day" | "week"

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const DAYS_PER_WEEK = 7

/**
 * Parse a YYYY-MM-DD date string to a UTC midnight Date object.
 * This avoids local-time shifts around DST boundaries.
 */
export function parseYmdToUtcMidnight(ymd: string): Date {
    // Expects `YYYY-MM-DD` (Supabase date-only strings).
    const [yRaw, mRaw, dRaw] = ymd.split("-").map((part) => Number(part))
    const y = yRaw
    const m = mRaw
    const d = dRaw

    // `y/m/d` can be `undefined` if the input doesn't split into 3 parts.
    // Also guard against NaN so we don't pass invalid values to `Date.UTC`.
    if (
        y == null ||
        m == null ||
        d == null ||
        !Number.isFinite(y) ||
        !Number.isFinite(m) ||
        !Number.isFinite(d)
    ) {
        // Fallback: keep runtime resilient (should not happen with DB date strings).
        const parsed = new Date(ymd)
        return parsed
    }
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

/**
 * Calculate the number of days between two dates.
 * Returns a positive number if endExclusive is after startInclusive.
 * Uses Math.floor to ensure integer results and avoid rounding issues.
 */
export function diffDaysUtc(startInclusive: Date, endExclusive: Date): number {
    const startMs = startInclusive.getTime()
    const endMs = endExclusive.getTime()
    // Use floor to ensure we get the correct number of complete days
    return Math.floor((endMs - startMs) / ONE_DAY_MS)
}

export function computeTimelineColumns<T extends HasCheckDates>(options: {
    reservations: readonly T[]
    maxDayColumns?: number
    maxWeekColumns?: number
}): {
    unit: TimelineUnit
    timelineStartUtc: Date
    timelineEndExclusiveUtc: Date
    columnStartsUtc: Date[]
} {
    const { reservations, maxDayColumns = 31, maxWeekColumns = 12 } = options

    if (reservations.length === 0) {
        const todayUtc = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 0, 0, 0, 0))
        return {
            unit: "day",
            timelineStartUtc: todayUtc,
            timelineEndExclusiveUtc: new Date(todayUtc.getTime() + ONE_DAY_MS),
            columnStartsUtc: [todayUtc],
        }
    }

    const startCandidates = reservations.map((r) => parseYmdToUtcMidnight(r.checkIn))
    const endCandidates = reservations.map((r) => parseYmdToUtcMidnight(r.checkOut))

    const timelineStartUtc = startCandidates.reduce((min, d) => (d.getTime() < min.getTime() ? d : min), startCandidates[0]!)
    const timelineEndExclusiveUtc = endCandidates.reduce((max, d) => (d.getTime() > max.getTime() ? d : max), endCandidates[0]!)

    const spanDays = diffDaysUtc(timelineStartUtc, timelineEndExclusiveUtc)
    const shouldUseWeeks = spanDays > maxDayColumns

    if (!shouldUseWeeks) {
        const days = Math.max(1, spanDays)
        const columnStartsUtc: Date[] = []
        for (let i = 0; i < days; i++) {
            columnStartsUtc.push(new Date(timelineStartUtc.getTime() + i * ONE_DAY_MS))
        }
        return {
            unit: "day",
            timelineStartUtc,
            timelineEndExclusiveUtc: new Date(timelineStartUtc.getTime() + days * ONE_DAY_MS),
            columnStartsUtc,
        }
    }

    const spanWeeks = Math.ceil(spanDays / DAYS_PER_WEEK)
    const weekColumns = Math.max(1, Math.min(spanWeeks, maxWeekColumns))

    const unitMs = DAYS_PER_WEEK * ONE_DAY_MS
    const timelineEnd = new Date(timelineStartUtc.getTime() + weekColumns * unitMs)

    const columnStartsUtc: Date[] = []
    for (let i = 0; i < weekColumns; i++) {
        columnStartsUtc.push(new Date(timelineStartUtc.getTime() + i * unitMs))
    }

    return {
        unit: "week",
        timelineStartUtc,
        timelineEndExclusiveUtc: timelineEnd,
        columnStartsUtc,
    }
}

export type IntervalForLanes = {
    id: string
    startMs: number
    endMs: number // exclusive
}

/**
 * Assign reservations to lanes (rows) so overlapping reservations
 * appear on different lanes.
 * 
 * Uses a greedy algorithm that places each reservation in the first
 * available lane where it doesn't overlap with existing reservations.
 */
export function assignLanes(intervals: readonly IntervalForLanes[]): {
    laneById: Map<string, number>
    laneCount: number
} {
    if (intervals.length === 0) {
        return { laneById: new Map(), laneCount: 0 }
    }

    // Sort by start time, then by end time for stable ordering
    const sorted = [...intervals].sort((a, b) => {
        if (a.startMs !== b.startMs) return a.startMs - b.startMs
        return a.endMs - b.endMs
    })

    // Track the "current" end for each lane (the end time of the last reservation in that lane)
    const laneEndMs: number[] = []
    const laneById = new Map<string, number>()

    for (const interval of sorted) {
        const endExclusive = interval.endMs

        // Find the first lane where this interval can fit
        // (i.e., the lane's last reservation ends before this one starts)
        let lane = -1
        for (let i = 0; i < laneEndMs.length; i++) {
            // Use <= so that reservations ending at the same time another starts don't overlap
            if (interval.startMs >= laneEndMs[i]!) {
                lane = i
                break
            }
        }

        if (lane === -1) {
            // No existing lane can accommodate this reservation, create a new lane
            lane = laneEndMs.length
            laneEndMs.push(endExclusive)
        } else {
            // Update the end time for this lane
            laneEndMs[lane] = endExclusive
        }

        laneById.set(interval.id, lane)
    }

    return { laneById, laneCount: laneEndMs.length }
}

/**
 * Format a date as YYYY-MM-DD string in UTC timezone
 */
export function formatYmd(date: Date): string {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, "0")
    const d = String(date.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

/**
 * Check if two date intervals overlap
 */
export function intervalsOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
): boolean {
    return start1 < end2 && start2 < end1
}

/**
 * Calculate the visible column range for a reservation within a timeline window.
 * Returns null when the reservation does not overlap the current timeline.
 */
export function getReservationRangeIndices(params: {
    unit: TimelineUnit
    timelineStartUtc: Date
    columnsCount: number
    reservation: HasCheckDates
}): { startIndex: number; endIndexExclusive: number } | null {
    const { unit, timelineStartUtc, columnsCount, reservation } = params

    const checkInUtc = parseYmdToUtcMidnight(reservation.checkIn)
    const checkOutUtc = parseYmdToUtcMidnight(reservation.checkOut)

    const offsetStartDays = diffDaysUtc(timelineStartUtc, checkInUtc)
    const offsetEndDays = diffDaysUtc(timelineStartUtc, checkOutUtc)

    let startIndex = offsetStartDays
    let endIndexExclusive = offsetEndDays

    if (unit === "week") {
        startIndex = Math.floor(offsetStartDays / DAYS_PER_WEEK)
        endIndexExclusive = Math.ceil(offsetEndDays / DAYS_PER_WEEK)
    }

    if (endIndexExclusive <= 0 || startIndex >= columnsCount) {
        return null
    }

    const clampedStart = Math.max(0, startIndex)
    const clampedEnd = Math.min(columnsCount, endIndexExclusive)

    if (clampedEnd <= clampedStart) {
        return null
    }

    return { startIndex: clampedStart, endIndexExclusive: clampedEnd }
}

/**
 * Group reservations by site, including empty sites as drop targets.
 */
export function groupReservationsBySite<TReservation extends ReservationForTimelineGrouping>(
    reservations: TReservation[],
    sites: TimelineSite[]
): SiteGroup<TReservation>[] {
    const map = new Map<string, SiteGroup<TReservation>>()

    for (const site of sites) {
        map.set(site.id, {
            siteId: site.id,
            siteName: site.siteName ?? (site.siteNumber ? `Site ${site.siteNumber}` : "Unnamed site"),
            siteNumber: site.siteNumber,
            siteType: site.siteType,
            reservations: [],
        })
    }

    for (const reservation of reservations) {
        const existing = map.get(reservation.siteId)
        if (!existing) {
            map.set(reservation.siteId, {
                siteId: reservation.siteId,
                siteName: reservation.siteName,
                siteNumber: reservation.siteNumber,
                siteType: reservation.siteType,
                reservations: [reservation],
            })
            continue
        }
        existing.reservations.push(reservation)
    }

    const groups = Array.from(map.values())
    groups.sort((a, b) => {
        const aNum = Number.parseInt(a.siteNumber, 10)
        const bNum = Number.parseInt(b.siteNumber, 10)
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) return aNum - bNum
        return a.siteName.localeCompare(b.siteName)
    })

    return groups
}
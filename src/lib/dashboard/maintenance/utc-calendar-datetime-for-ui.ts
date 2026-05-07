/**
 * Maintenance schedules / PM-generated tasks often store the work window as UTC
 * midnight → UTC 23:59 on the same *calendar* date (e.g. 2026-05-15 00:00:00+00 … 23:59+00).
 * Parsing those with `new Date(iso)` in a non-UTC timezone shifts the wall clock
 * (e.g. +8 shows 08:00 and next-day 07:59). For UI/forms, reinterpret as that same
 * calendar date at local start/end of day.
 */
export function normalizeUtcCalendarStartForUi(iso: string | null | undefined): string | null {
    if (!iso?.trim()) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    if (
        d.getUTCHours() === 0
        && d.getUTCMinutes() === 0
        && d.getUTCSeconds() === 0
        && d.getUTCMilliseconds() === 0
    ) {
        return new Date(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            0,
            0,
            0,
            0,
        ).toISOString()
    }
    return iso
}

export function normalizeUtcCalendarEndForUi(iso: string | null | undefined): string | null {
    if (!iso?.trim()) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const h = d.getUTCHours()
    const m = d.getUTCMinutes()
    const s = d.getUTCSeconds()
    if (h === 23 && m === 59 && (s === 0 || s === 59)) {
        return new Date(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            23,
            59,
            0,
            0,
        ).toISOString()
    }
    return iso
}

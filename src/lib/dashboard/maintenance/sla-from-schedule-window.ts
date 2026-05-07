export function slaHoursFromScheduledWindow(
    scheduledStart: string | null | undefined,
    dueDate: string | null | undefined,
): number | null {
    if (!scheduledStart?.trim() || !dueDate?.trim()) return null
    const startMs = new Date(scheduledStart).getTime()
    const endMs = new Date(dueDate).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
    return Math.max(0, Math.round((endMs - startMs) / 3600000))
}

export function computeResumedMaintenanceStartedAtMs(input: {
  startedAtMs: number
  holdAtMs: number
  resumeAtMs: number
}): number {
  const { startedAtMs, holdAtMs, resumeAtMs } = input
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(holdAtMs) || !Number.isFinite(resumeAtMs)) {
    return startedAtMs
  }
  if (holdAtMs <= startedAtMs) return startedAtMs
  return startedAtMs + (resumeAtMs - holdAtMs)
}

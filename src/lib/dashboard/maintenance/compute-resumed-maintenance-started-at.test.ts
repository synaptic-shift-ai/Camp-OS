import { describe, expect, test } from 'vitest'
import { computeResumedMaintenanceStartedAtMs } from './compute-resumed-maintenance-started-at'

describe('computeResumedMaintenanceStartedAtMs', () => {
  test('returns started_at such that resumeAt minus new start equals active seconds before hold', () => {
    const startedAtMs = 1_000_000
    const holdAtMs = startedAtMs + 20_000
    const resumeAtMs = holdAtMs + 60_000
    const newStartMs = computeResumedMaintenanceStartedAtMs({ startedAtMs, holdAtMs, resumeAtMs })
    expect(newStartMs).toBe(startedAtMs + 60_000)
    expect(resumeAtMs - newStartMs).toBe(20_000)
  })

  test('when hold timestamp is not after started_at, returns original started_at', () => {
    const startedAtMs = 5_000_000
    const holdAtMs = startedAtMs
    const resumeAtMs = startedAtMs + 1_000
    expect(computeResumedMaintenanceStartedAtMs({ startedAtMs, holdAtMs, resumeAtMs })).toBe(startedAtMs)
  })
})

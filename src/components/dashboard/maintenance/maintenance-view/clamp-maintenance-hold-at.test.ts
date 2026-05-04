import { describe, expect, test } from "vitest"
import { clampMaintenanceHoldAtIso } from "./clamp-maintenance-hold-at"

describe("clampMaintenanceHoldAtIso", () => {
  test("when server hold time is before the last in-progress timer end, uses the later end so elapsed does not jump backward", () => {
    const epochOffsetMs = 10_000
    const elapsedBeforeHoldMs = 594_000
    const serverSkewMs = 5_000
    const startedAtIso = new Date(epochOffsetMs).toISOString()
    const previous = { started_at: startedAtIso }

    const lastProgressEndMs = epochOffsetMs + elapsedBeforeHoldMs
    const serverHoldMs = epochOffsetMs + elapsedBeforeHoldMs - serverSkewMs
    const result = clampMaintenanceHoldAtIso(new Date(serverHoldMs).toISOString(), previous, lastProgressEndMs)
    expect(new Date(result).getTime()).toBe(lastProgressEndMs)
  })

  test("when server time is omitted, returns max of last progress end and started_at", () => {
    const epochOffsetMs = 1_000
    const previous = { started_at: new Date(epochOffsetMs).toISOString() }
    const lastProgressEndMs = epochOffsetMs + 400_000
    const result = clampMaintenanceHoldAtIso(undefined, previous, lastProgressEndMs)
    expect(new Date(result).getTime()).toBe(lastProgressEndMs)
  })
})

import { describe, expect, test } from 'vitest'
import {
  normalizeUtcCalendarEndForUi,
  normalizeUtcCalendarStartForUi,
} from './utc-calendar-datetime-for-ui'

describe('normalizeUtcCalendarStartForUi', () => {
  test('maps UTC midnight to local midnight on the same calendar date', () => {
    const out = normalizeUtcCalendarStartForUi('2026-05-15T00:00:00.000Z')
    expect(out).toBeTruthy()
    if (!out) throw new Error('expected normalized start')
    const d = new Date(out)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4)
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })
})

describe('normalizeUtcCalendarEndForUi', () => {
  test('maps UTC 23:59 to local 23:59 on the same calendar date', () => {
    const out = normalizeUtcCalendarEndForUi('2026-05-15T23:59:00.000Z')
    expect(out).toBeTruthy()
    if (!out) throw new Error('expected normalized end')
    const d = new Date(out)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4)
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
  })
})

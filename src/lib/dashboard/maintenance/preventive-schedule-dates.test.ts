import { format } from 'date-fns'
import { describe, expect, test } from 'vitest'
import {
  computeInitialWeeklyOccurrence,
  computeNextWeeklyOccurrence,
  firstWeekdayOnOrAfter,
} from './preventive-schedule-dates'

describe('computeNextWeeklyOccurrence', () => {
  test('advances exactly one week from previous scheduled Monday', () => {
    const next = computeNextWeeklyOccurrence('2026-05-11', 'Monday', new Date('2026-05-13T15:00:00'))
    expect(format(next, 'yyyy-MM-dd')).toBe('2026-05-18')
  })

  test('without previous schedule uses next weekday after completion', () => {
    const next = computeNextWeeklyOccurrence(null, 'Monday', new Date('2026-05-13T15:00:00'))
    expect(format(next, 'yyyy-MM-dd')).toBe('2026-05-18')
  })
})

describe('computeInitialWeeklyOccurrence', () => {
  test('returns same-week Monday when from is Sunday before that Monday', () => {
    const from = new Date(2026, 4, 10, 12, 0, 0)
    const initial = computeInitialWeeklyOccurrence(from, 'Monday')
    expect(format(initial, 'yyyy-MM-dd')).toBe('2026-05-11')
  })
})

describe('firstWeekdayOnOrAfter', () => {
  test('includes start day when it already matches', () => {
    const mon = new Date(2026, 4, 11, 8, 0, 0)
    const out = firstWeekdayOnOrAfter(mon, 'Monday')
    expect(format(out, 'yyyy-MM-dd')).toBe('2026-05-11')
  })
})

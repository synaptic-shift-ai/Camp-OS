import { describe, expect, test } from 'vitest'
import {
  stayOverlapsMaintenanceCalendarDay,
  stayOverlapsPreventiveMaintenanceSchedule,
} from './maintenance-schedule-blocks'

describe('stayOverlapsMaintenanceCalendarDay', () => {
  test('returns true when maintenance day is checkout day', () => {
    expect(stayOverlapsMaintenanceCalendarDay('2026-06-06', '2026-06-07', '2026-06-07')).toBe(true)
  })

  test('returns true when maintenance day is check-in day', () => {
    expect(stayOverlapsMaintenanceCalendarDay('2026-06-07', '2026-06-08', '2026-06-07')).toBe(true)
  })

  test('returns true when stay spans maintenance day', () => {
    expect(stayOverlapsMaintenanceCalendarDay('2026-06-06', '2026-06-08', '2026-06-07')).toBe(true)
  })

  test('returns false when stay ends before maintenance day', () => {
    expect(stayOverlapsMaintenanceCalendarDay('2026-06-01', '2026-06-06', '2026-06-07')).toBe(false)
  })

  test('returns false when stay starts after maintenance day', () => {
    expect(stayOverlapsMaintenanceCalendarDay('2026-06-08', '2026-06-10', '2026-06-07')).toBe(false)
  })
})

describe('stayOverlapsPreventiveMaintenanceSchedule', () => {
  test('monthly: blocks Jun 6–7, Jun 7–8, and Jun 6–8 when anchor is every 7th', () => {
    const schedule = {
      frequency: 'monthly',
      schedule_date: '2026-05-07',
      days: null,
    } as const

    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-06', '2026-06-07', schedule)).toBe(true)
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-07', '2026-06-08', schedule)).toBe(true)
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-06', '2026-06-08', schedule)).toBe(true)
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-01', '2026-06-06', schedule)).toBe(false)
  })

  test('monthly: uses day-of-month from schedule_date, not month', () => {
    const schedule = {
      frequency: 'monthly',
      schedule_date: '2026-12-07',
      days: null,
    } as const
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-06', '2026-06-07', schedule)).toBe(true)
  })

  test('monthly: day 31 clamps in June to June 30', () => {
    const schedule = {
      frequency: 'monthly',
      schedule_date: '2026-05-31',
      days: null,
    } as const
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-29', '2026-06-30', schedule)).toBe(true)
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-01', '2026-06-29', schedule)).toBe(false)
  })

  test('weekly: blocks when stay includes that weekday', () => {
    const schedule = {
      frequency: 'weekly',
      schedule_date: null,
      days: 'Monday',
    } as const
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-08', '2026-06-09', schedule)).toBe(true)
  })

  test('weekly: normalizes lowercase weekday', () => {
    const schedule = {
      frequency: 'weekly',
      schedule_date: null,
      days: 'monday',
    } as const
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-08', '2026-06-09', schedule)).toBe(true)
  })

  test('weekly: does not block when weekday not in range', () => {
    const schedule = {
      frequency: 'weekly',
      schedule_date: null,
      days: 'Wednesday',
    } as const
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-08', '2026-06-09', schedule)).toBe(false)
  })

  test('annual: repeats on same month/day each year', () => {
    const schedule = {
      frequency: 'annual',
      schedule_date: '2025-06-07',
      days: null,
    } as const
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-06', '2026-06-07', schedule)).toBe(true)
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-01', '2026-06-06', schedule)).toBe(false)
  })

  test('returns false when monthly has no schedule_date', () => {
    const schedule = { frequency: 'monthly', schedule_date: null, days: null } as const
    expect(stayOverlapsPreventiveMaintenanceSchedule('2026-06-06', '2026-06-08', schedule)).toBe(false)
  })
})

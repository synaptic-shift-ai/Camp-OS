import { describe, expect, test } from 'vitest'
import {
  isPreventiveScheduleDue,
  resolvePreventiveScheduleNextDueDate,
  shouldGeneratePreventiveWorkOrder,
} from './pm-schedule-due'

describe('resolvePreventiveScheduleNextDueDate', () => {
  test('returns open work order scheduled day when one exists', () => {
    expect(
      resolvePreventiveScheduleNextDueDate({
        frequency: 'monthly',
        scheduleDate: '2026-06-01',
        openWorkOrderScheduledStart: '2026-06-10T00:00:00.000Z',
      }),
    ).toBe('2026-06-10')
  })

  test('returns schedule_date when no open work order', () => {
    expect(
      resolvePreventiveScheduleNextDueDate({
        frequency: 'monthly',
        scheduleDate: '2026-06-15',
      }),
    ).toBe('2026-06-15')
  })

  test('computes weekly next due from last completion', () => {
    expect(
      resolvePreventiveScheduleNextDueDate({
        frequency: 'weekly',
        lastCompletedAt: '2026-06-01T18:00:00.000Z',
      }),
    ).toBe('2026-06-08')
  })
})

describe('shouldGeneratePreventiveWorkOrder', () => {
  test('returns false when an open work order already exists', () => {
    expect(
      shouldGeneratePreventiveWorkOrder({
        frequency: 'monthly',
        scheduleDate: '2026-01-01',
        hasOpenWorkOrder: true,
        asOf: new Date('2026-06-15T12:00:00.000Z'),
      }),
    ).toBe(false)
  })

  test('returns true when schedule is overdue and no open work order', () => {
    expect(
      shouldGeneratePreventiveWorkOrder({
        frequency: 'monthly',
        scheduleDate: '2026-06-01',
        hasOpenWorkOrder: false,
        asOf: new Date('2026-06-15T12:00:00.000Z'),
      }),
    ).toBe(true)
  })

  test('returns false when next due date is in the future', () => {
    expect(
      shouldGeneratePreventiveWorkOrder({
        frequency: 'monthly',
        scheduleDate: '2026-07-01',
        hasOpenWorkOrder: false,
        asOf: new Date('2026-06-15T12:00:00.000Z'),
      }),
    ).toBe(false)
  })
})

describe('isPreventiveScheduleDue', () => {
  test('returns true when due date is today', () => {
    expect(
      isPreventiveScheduleDue('2026-06-15', new Date('2026-06-15T23:59:00.000Z')),
    ).toBe(true)
  })
})

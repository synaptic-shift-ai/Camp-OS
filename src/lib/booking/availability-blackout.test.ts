import { describe, test, expect } from 'vitest'
import { siteStayOverlapsBlackoutDates } from './availability'

describe('siteStayOverlapsBlackoutDates', () => {
  test('blocks when blackout is on check-out day (e.g. Mar 26–27 stay, Mar 27 blacked out)', () => {
    expect(
      siteStayOverlapsBlackoutDates(
        { blackout_dates: ['2026-03-27', '2026-03-28', '2026-03-29'] },
        '2026-03-26',
        '2026-03-27',
      ),
    ).toBe(true)
  })

  test('blocks when check-in is on a blackout day', () => {
    expect(
      siteStayOverlapsBlackoutDates({ blackout_dates: ['2026-03-27'] }, '2026-03-27', '2026-03-28'),
    ).toBe(true)
  })

  test('returns false when stay does not touch any blackout day', () => {
    expect(
      siteStayOverlapsBlackoutDates(
        { blackout_dates: ['2026-03-27', '2026-03-28'] },
        '2026-03-24',
        '2026-03-26',
      ),
    ).toBe(false)
  })

  test('returns false when blackout_dates is empty or missing', () => {
    expect(siteStayOverlapsBlackoutDates({}, '2026-03-26', '2026-03-27')).toBe(false)
    expect(siteStayOverlapsBlackoutDates({ blackout_dates: [] }, '2026-03-26', '2026-03-27')).toBe(false)
    expect(siteStayOverlapsBlackoutDates(null, '2026-03-26', '2026-03-27')).toBe(false)
  })
})

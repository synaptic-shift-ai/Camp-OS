import { describe, test, expect } from 'vitest'
import { siteStayOverlapsBlackoutDates } from './availability'

describe('siteStayOverlapsBlackoutDates', () => {
  // NOTE: despite the "StayOverlaps" name, this helper only receives a
  // check-in date - there is no checkout parameter and no range variant. Its
  // contract (availability.ts) is "check-in must not fall on a blackout day",
  // and checkSiteAvailability explicitly allows same-day turnover, so the
  // check-out day is not treated as occupied. This case previously asserted
  // whole-stay semantics the helper does not implement.
  test('does not block when only the check-out day is blacked out', () => {
    // Mar 26-27 stay occupies the night of the 26th; the guest is gone before
    // the 27th begins, so a blackout starting on the 27th is not a conflict.
    expect(
      siteStayOverlapsBlackoutDates(
        { blackout_dates: ['2026-03-27', '2026-03-28', '2026-03-29'] },
        '2026-03-26',
      ),
    ).toBe(false)
  })

  test('blocks when check-in is on a blackout day', () => {
    expect(
      siteStayOverlapsBlackoutDates({ blackout_dates: ['2026-03-27'] }, '2026-03-27'),
    ).toBe(true)
  })

  test('returns false when stay does not touch any blackout day', () => {
    expect(
      siteStayOverlapsBlackoutDates(
        { blackout_dates: ['2026-03-27', '2026-03-28'] },
        '2026-03-24',
      ),
    ).toBe(false)
  })

  test('returns false when blackout_dates is empty or missing', () => {
    expect(siteStayOverlapsBlackoutDates({}, '2026-03-26')).toBe(false)
    expect(siteStayOverlapsBlackoutDates({ blackout_dates: [] }, '2026-03-26')).toBe(false)
    expect(siteStayOverlapsBlackoutDates(null, '2026-03-26')).toBe(false)
  })
})

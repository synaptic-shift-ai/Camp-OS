import { describe, it, expect } from 'vitest'
import {
  extractOpenPeriodFromPropertySettings,
  openPeriodRestrictsBookings,
  isStayWithinOpenPeriodByIsoDates,
  formatOpenPeriodGuestMessage,
} from './open-period'

describe('extractOpenPeriodFromPropertySettings', () => {
  it('returns nulls for non-object settings', () => {
    expect(extractOpenPeriodFromPropertySettings(null)).toEqual({
      openPeriodFrom: null,
      openPeriodUntil: null,
    })
  })

  it('reads camelCase and snake_case ISO dates', () => {
    expect(
      extractOpenPeriodFromPropertySettings({
        openPeriodFrom: '2025-03-01',
        open_period_until: '2025-04-30',
      }),
    ).toEqual({ openPeriodFrom: '2025-03-01', openPeriodUntil: '2025-04-30' })
  })
})

describe('openPeriodRestrictsBookings', () => {
  it('is false when either bound is missing', () => {
    expect(openPeriodRestrictsBookings(null, '2025-04-30')).toBe(false)
    expect(openPeriodRestrictsBookings('2025-03-01', null)).toBe(false)
    expect(openPeriodRestrictsBookings('', '2025-04-30')).toBe(false)
  })

  it('is true when both bounds are set', () => {
    expect(openPeriodRestrictsBookings('2025-03-01', '2025-04-30')).toBe(true)
  })
})

describe('isStayWithinOpenPeriodByIsoDates', () => {
  it('allows any dates when open period is not configured', () => {
    expect(isStayWithinOpenPeriodByIsoDates('2025-05-02', '2025-05-03', null, null)).toBe(true)
    expect(isStayWithinOpenPeriodByIsoDates('2025-05-02', '2025-05-03', '2025-03-01', null)).toBe(true)
  })

  it('rejects check-in before season', () => {
    expect(
      isStayWithinOpenPeriodByIsoDates('2025-05-02', '2025-05-03', '2025-05-10', '2025-06-01'),
    ).toBe(false)
  })

  it('rejects stay extending past season end', () => {
    expect(
      isStayWithinOpenPeriodByIsoDates('2025-04-29', '2025-05-02', '2025-03-01', '2025-04-30'),
    ).toBe(false)
  })

  it('rejects stay when checkout is after season end even if last night is on season end', () => {
    expect(
      isStayWithinOpenPeriodByIsoDates('2025-03-26', '2025-05-01', '2025-03-01', '2025-04-30'),
    ).toBe(false)
  })

  it('allows stay with checkout on the last day of the season', () => {
    expect(
      isStayWithinOpenPeriodByIsoDates('2025-03-26', '2025-04-30', '2025-03-01', '2025-04-30'),
    ).toBe(true)
  })

  it('allows stay fully inside season', () => {
    expect(
      isStayWithinOpenPeriodByIsoDates('2025-04-10', '2025-04-12', '2025-03-01', '2025-04-30'),
    ).toBe(true)
  })
})

describe('formatOpenPeriodGuestMessage', () => {
  it('formats same-calendar-year range', () => {
    expect(formatOpenPeriodGuestMessage('2025-03-01', '2025-04-30')).toBe(
      'March 1 to April 30, 2025',
    )
  })
})

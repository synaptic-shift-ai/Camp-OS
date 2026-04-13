import { describe, expect, test } from 'vitest'
import { getApiFailureMessage } from '@/lib/api/get-api-failure-message'

describe('getApiFailureMessage', () => {
  test('returns top-level message when present', () => {
    expect(getApiFailureMessage({ success: false, message: '  Not allowed  ' })).toBe('Not allowed')
  })

  test('returns nested error.message when top-level message missing', () => {
    expect(
      getApiFailureMessage({ success: false, error: { code: 'X', message: 'Nested' } }),
    ).toBe('Nested')
  })

  test('returns undefined for empty or invalid input', () => {
    expect(getApiFailureMessage(null)).toBeUndefined()
    expect(getApiFailureMessage({ success: false })).toBeUndefined()
  })
})

import { describe, expect, test } from 'vitest'
import { detectPhoneCountry, normalizePhone, parseE164 } from './phone-utils'

describe('detectPhoneCountry', () => {
  test('detects Philippine national mobile numbers starting with 09', () => {
    expect(detectPhoneCountry('09927323438')).toEqual({
      countryCode: 'PH',
      nationalDigits: '9927323438',
    })
  })

  test('detects Philippine numbers early while typing 09 prefix', () => {
    expect(detectPhoneCountry('099')).toEqual({
      countryCode: 'PH',
      nationalDigits: '99',
    })
  })

  test('detects Philippine international format without plus sign', () => {
    expect(detectPhoneCountry('639927323438')).toEqual({
      countryCode: 'PH',
      nationalDigits: '9927323438',
    })
  })

  test('does not misclassify standard US 10-digit numbers', () => {
    expect(detectPhoneCountry('5551234567')).toBeNull()
  })

  test('detects UK mobile numbers starting with 07', () => {
    expect(detectPhoneCountry('07911123456')).toEqual({
      countryCode: 'GB',
      nationalDigits: '7911123456',
    })
  })
})

describe('normalizePhone', () => {
  test('normalizes Philippine national format to E.164', () => {
    expect(normalizePhone('09927323438')).toBe('+639927323438')
  })

  test('keeps US numbers on +1', () => {
    expect(normalizePhone('5551234567')).toBe('+15551234567')
  })

  test('parses stored Philippine E.164 back to PH country', () => {
    expect(parseE164('+639927323438')).toEqual({
      dialCode: '+63',
      digits: '9927323438',
      countryCode: 'PH',
    })
  })
})

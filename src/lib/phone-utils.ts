import { COUNTRIES, getCountryByCode } from './countries'

export type DetectedPhoneCountry = {
  countryCode: string
  nationalDigits: string
}

/**
 * Infer country from digits typed without an explicit + prefix.
 * Used for national formats (e.g. Philippine 09XX) and pasted international numbers.
 */
export function detectPhoneCountry(digits: string): DetectedPhoneCountry | null {
  if (!digits) return null

  // Philippines: international without + (639XXXXXXXXX) or national trunk prefix (09XX)
  if (digits.startsWith('639') && digits.length >= 5) {
    return { countryCode: 'PH', nationalDigits: digits.slice(2) }
  }
  if (digits.startsWith('09') && digits.length >= 3) {
    return { countryCode: 'PH', nationalDigits: digits.slice(1) }
  }

  // United Kingdom mobile: 07XXXXXXXXX
  if (digits.startsWith('07') && digits.length >= 4) {
    return { countryCode: 'GB', nationalDigits: digits.slice(1) }
  }

  // Australia mobile: 04XXXXXXXX
  if (digits.startsWith('04') && digits.length >= 4) {
    return { countryCode: 'AU', nationalDigits: digits.slice(1) }
  }

  // India: 10-digit mobile or leading 0 + 10 digits
  if (/^0[6-9]\d{9}$/.test(digits)) {
    return { countryCode: 'IN', nationalDigits: digits.slice(1) }
  }

  // Generic international: only when long enough to avoid false positives (e.g. US 555… vs +55 Brazil)
  if (digits.length >= 11) {
    const parsed = parseE164(`+${digits}`)
    if (parsed && parsed.digits.length >= 6) {
      return { countryCode: parsed.countryCode, nationalDigits: parsed.digits }
    }
  }

  return null
}

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return ''

  const stripped = phone.replace(/[\s\-\(\)\.]/g, '')

  if (stripped.startsWith('+')) return stripped

  const digits = stripped.replace(/\D/g, '')
  const detected = detectPhoneCountry(digits)
  if (detected) {
    const country = getCountryByCode(detected.countryCode)
    if (country) {
      return toE164(detected.nationalDigits, country.dialCode)
    }
  }

  if (/^\d{10}$/.test(digits)) return `+1${digits}`

  if (/^1\d{10}$/.test(digits)) return `+${digits}`

  return `+1${digits}`
}

export function formatPhone(digits: string, format: string): string {
  if (!digits) return ''

  let di = 0
  let result = ''

  for (let i = 0; i < format.length; i++) {
    if (di >= digits.length) break
    if (format[i] === 'X') {
      result += digits[di]
      di++
    } else {
      result += format[i]
    }
  }

  if (di < digits.length) {
    result += digits.slice(di)
  }

  return result
}

export function toE164(digits: string, dialCode: string): string {
  if (!digits) return ''
  return `${dialCode}${digits}`
}

export function parseE164(e164: string): { dialCode: string; digits: string; countryCode: string } | null {
  if (!e164 || !e164.startsWith('+')) return null

  const numeric = e164.slice(1)
  if (!/^\d+$/.test(numeric)) return null

  // Find the longest matching dial code among all countries
  let bestMatch: { code: string; dialDigits: string } | null = null

  for (const country of COUNTRIES) {
    const dialDigits = country.dialCode.slice(1) // remove '+'
    if (
      numeric.startsWith(dialDigits) &&
      (!bestMatch || dialDigits.length > bestMatch.dialDigits.length)
    ) {
      bestMatch = { code: country.code, dialDigits }
    }
  }

  if (!bestMatch) return null

  const country = getCountryByCode(bestMatch.code)!
  const digits = numeric.slice(bestMatch.dialDigits.length)

  return {
    dialCode: country.dialCode,
    digits,
    countryCode: country.code,
  }
}

export function isValidE164(phone: string): boolean {
  return /^\+\d{7,15}$/.test(phone)
}

export function getPlaceholder(countryCode: string): string {
  const country = getCountryByCode(countryCode)
  return country?.placeholder ?? ''
}

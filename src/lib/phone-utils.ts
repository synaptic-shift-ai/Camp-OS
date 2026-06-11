import { COUNTRIES, getCountryByCode } from './countries'

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return ''

  const stripped = phone.replace(/[\s\-\(\)\.]/g, '')

  if (stripped.startsWith('+')) return stripped

  if (/^\d{10}$/.test(stripped)) return `+1${stripped}`

  if (/^1\d{10}$/.test(stripped)) return `+${stripped}`

  return `+1${stripped}`
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

import { validate } from 'postal-codes-js';
import { getTimezoneCountry } from './timezone-to-country';

/**
 * Validate a postal code for a given country using postal-codes-js.
 * Returns true if valid, or a short error message string if invalid.
 * Returns true (skip) if the country is unsupported by the library.
 */
export function validatePostalCode(countryCode: string, postalCode: string): string | true {
  try {
    const result = validate(countryCode, postalCode);
    if (result === true) return true;
    if (typeof result === 'string' && result !== 'true') return 'Zip code is not valid in your timezone';
    return true;
  } catch {
    return true;
  }
}

/**
 * Auto-detect the user's country code from browser timezone.
 * Returns null if detection fails or timezone has no country (e.g., UTC).
 * Safe to call in browser only (uses Intl API).
 */
export function getDetectedCountryCode(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return getTimezoneCountry(timezone);
  } catch {
    return null;
  }
}

/**
 * Get the auto-detected timezone string from the browser.
 * Returns null if detection fails.
 * Safe to call in browser only (uses Intl API).
 */
export function getDetectedTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

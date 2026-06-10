export const ZIP_CODE_MIN_LENGTH = 3

export const ZIP_CODE_MIN_LENGTH_MESSAGE = `Zip code must be at least ${ZIP_CODE_MIN_LENGTH} characters`

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

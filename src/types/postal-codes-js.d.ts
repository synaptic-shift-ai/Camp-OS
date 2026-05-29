/**
 * Type declarations for postal-codes-js.
 * Only used when the package is not installed yet.
 * Once `npm install` succeeds, the bundled index.d.ts takes precedence.
 */
declare module 'postal-codes-js' {
  /**
   * Validate a postal code for a given country.
   * @param countryCode ISO 3166-1 alpha-2 or alpha-3 country code.
   * @param postalCode Postal code as string or number.
   * @returns true if valid, error message string if invalid.
   */
  export function validate(
    countryCode: string,
    postalCode: string | number
  ): boolean | string;
}

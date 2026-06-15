/**
 * Booking Page Slug Utilities
 *
 * Functions for generating and parsing property booking page slugs.
 * Slug format: {sanitized-property-name}-{short-uuid}
 * Example: pine-valley-campground-550e8400
 */

/**
 * Generate a URL-safe booking page slug from property name and ID
 *
 * @param propertyName - The property name (e.g., "Pine Valley Campground")
 * @param propertyId - The full property UUID
 * @returns URL-safe slug (e.g., "pine-valley-campground-550e8400")
 *
 * @example
 * generateBookingSlug("Pine Valley Campground", "550e8400-e29b-41d4-a716-446655440000")
 * // Returns: "pine-valley-campground-550e8400"
 */
export function generateBookingSlug(propertyName: string, propertyId: string): string {
  // 1. Sanitize property name (strip apostrophes first so "Trip's" → "trips", not "trip-s")
  const sanitized = propertyName
    .toLowerCase()
    .trim()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .substring(0, 50)              // Max 50 chars for readability

  // 2. Take first 8 chars of UUID for uniqueness
  const shortId = propertyId.slice(0, 8)

  // 3. Combine
  return `${sanitized}-${shortId}`
}

/**
 * Extract the property ID prefix from a booking page slug
 *
 * @param slug - The booking page slug (e.g., "pine-valley-campground-550e8400")
 * @returns Property ID prefix (e.g., "550e8400")
 *
 * @example
 * extractPropertyIdFromSlug("pine-valley-campground-550e8400")
 * // Returns: "550e8400"
 */
export function extractPropertyIdFromSlug(slug: string): string {
  // Slug format: "property-name-abc12345"
  // Last segment after final hyphen is the short ID
  const parts = slug.split('-')
  const shortId = parts[parts.length - 1] || ''

  // Validate it looks like a UUID prefix (8 hex chars)
  if (!/^[a-f0-9]{8}$/i.test(shortId)) {
    throw new Error(`Invalid slug format: "${slug}". Expected format: property-name-abc12345`)
  }

  return shortId
}

/**
 * Generate the full booking page URL for a property
 *
 * @param slug - The booking page slug
 * @param baseUrl - Optional base URL (defaults to NEXT_PUBLIC_BASE_URL or localhost)
 * @returns Full booking page URL
 *
 * @example
 * generateBookingUrl("pine-valley-campground-550e8400")
 * // Returns: "https://yourdomain.com/book/pine-valley-campground-550e8400"
 */
export function generateBookingUrl(slug: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  return `${base}/book/${slug}`
}

/**
 * Validate that a slug is well-formed
 *
 * @param slug - The slug to validate
 * @returns true if valid, false otherwise
 */
export function isValidBookingSlug(slug: string): boolean {
  try {
    extractPropertyIdFromSlug(slug)
    return true
  } catch {
    return false
  }
}

/**
 * Template Personalization
 *
 * Handles {{variable}} replacement in message templates.
 */

// ============================================================================
// Constants
// ============================================================================

export const SUPPORTED_VARIABLES = [
  'guest_first_name',
  'guest_last_name',
  'guest_email',
  'guest_phone',
  'location',
  'booking_date',
  'check_in_date',
  'check_out_date',
] as const

export type SupportedVariable = (typeof SUPPORTED_VARIABLES)[number]

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that a template text only uses supported variables.
 * Returns whether the template is valid and a list of unsupported variable names.
 */
export function validateTemplateVariables(text: string): {
  valid: boolean
  unsupported: string[]
} {
  const matches = text.matchAll(VARIABLE_REGEX)
  const found = new Set<string>()

  for (const match of matches) {
    const varName = match[1]
    if (varName) found.add(varName)
  }

  const supportedSet = new Set<string>(SUPPORTED_VARIABLES)
  const unsupported = [...found].filter((v) => !supportedSet.has(v))

  return {
    valid: unsupported.length === 0,
    unsupported,
  }
}

// ============================================================================
// Personalization
// ============================================================================

/**
 * Replace {{variable}} placeholders in a template string with provided values.
 * Unknown variables are left as-is (not stripped).
 */
export function personalizeMessage(
  template: string,
  data: Record<string, string>,
): string {
  return template.replace(VARIABLE_REGEX, (match, varName: string) => {
    if (varName in data) {
      return data[varName] ?? match
    }
    // Leave unknown variables as-is
    return match
  })
}

/**
 * Build personalization data from a guest record, optional booking, and property.
 * Returns a flat map of variable names to string values.
 */
export function buildPersonalizationData(
  guest: Record<string, unknown>,
  booking?: Record<string, unknown> | null,
  property?: Record<string, unknown> | null,
): Record<string, string> {
  const data: Record<string, string> = {
    guest_first_name: String(guest.first_name ?? ''),
    guest_last_name: String(guest.last_name ?? ''),
    guest_email: String(guest.email ?? ''),
    guest_phone: String(guest.phone ?? ''),
  }

  if (property) {
    data.location = String(
      property.name ?? property.address ?? '',
    )
  }

  if (booking) {
    data.booking_date = formatDate(booking.created_at as string | null)
    data.check_in_date = formatDate(booking.check_in_date as string | null)
    data.check_out_date = formatDate(booking.check_out_date as string | null)
  }

  return data
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

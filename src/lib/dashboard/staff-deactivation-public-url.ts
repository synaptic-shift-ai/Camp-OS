/**
 * Public URL to send users after their property_staff assignment is set to inactive.
 * Override with NEXT_PUBLIC_STAFF_DEACTIVATED_REDIRECT_URL; otherwise uses app base URL
 * or the production Camp-OS host as a last resort.
 */
export function getStaffDeactivationPublicUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_STAFF_DEACTIVATED_REDIRECT_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    'https://campos.vyte.blue'
  try {
    const url = new URL(raw)
    return `${url.origin}/`
  } catch {
    return 'https://campos.vyte.blue/'
  }
}

/**
 * Check if an error indicates a 403 access denied response from the API.
 *
 * The RBAC deny() function returns JSON: { success: false, error: { code: 'AUTH_003', message: '...' } }
 * When parsed on the client, we check for:
 * - 403 status code in fetch responses
 * - 'AUTH_003' error code
 * - 'forbidden' or 'access denied' in the message
 */
export function isAccessDeniedError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('403') ||
      msg.includes('auth_003') ||
      msg.includes('forbidden') ||
      msg.includes('access denied') ||
      msg.includes('insufficient role') ||
      msg.includes('permission denied')
    )
  }
  if (typeof error === 'string') {
    const msg = error.toLowerCase()
    return (
      msg.includes('403') ||
      msg.includes('auth_003') ||
      msg.includes('forbidden') ||
      msg.includes('access denied') ||
      msg.includes('insufficient role') ||
      msg.includes('permission denied')
    )
  }
  return false
}

/**
 * User-facing error text from API JSON: flat `{ success: false, message }` or nested `{ error: { message } }`.
 */
export function getApiFailureMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const r = data as Record<string, unknown>
  if (typeof r.message === 'string') {
    const m = r.message.trim()
    if (m.length > 0) return m
  }
  const nested = r.error
  if (nested && typeof nested === 'object' && 'message' in nested) {
    const msg = (nested as { message?: unknown }).message
    if (typeof msg === 'string') {
      const m = msg.trim()
      if (m.length > 0) return m
    }
  }
  if (typeof nested === 'string') {
    const m = nested.trim()
    if (m.length > 0) return m
  }
  return undefined
}

/**
 * React Hook: useActionAvailability
 *
 * Provides real-time availability checking for reservation actions.
 * Automatically debounces API calls as user types/selects dates.
 */

import { useState, useEffect, useCallback } from 'react'
import type { ActionAvailabilityCheck, CheckActionRequest } from '@/lib/booking/types'

export function useActionAvailability(
  reservationId: string,
  action: 'extend' | 'renew',
  params: CheckActionRequest['params']
) {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ActionAvailabilityCheck | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkAvailability = useCallback(async () => {
    // Don't check if required params are missing
    const hasRequiredParams =
      (action === 'extend' && (params.newCheckOut || params.newCheckIn)) ||
      (action === 'renew' && params.nextPeriodStart && params.nextPeriodEnd)

    if (!hasRequiredParams) {
      setResult(null)
      return
    }

    setChecking(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/reservations/${reservationId}/check-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Availability check failed')
      }

      const responseData = await response.json()
      const data: ActionAvailabilityCheck = responseData.data
      setResult(data)
    } catch (err) {
      console.error('[useActionAvailability] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to check availability')
      setResult(null)
    } finally {
      setChecking(false)
    }
  }, [reservationId, action, JSON.stringify(params)])

  // Auto-check when params change (with debounce)
  useEffect(() => {
    const timer = setTimeout(checkAvailability, 500)
    return () => clearTimeout(timer)
  }, [checkAvailability])

  return {
    checking,
    result,
    error,
    recheck: checkAvailability,
  }
}

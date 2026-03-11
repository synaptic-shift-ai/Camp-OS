'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCheckout } from '@/lib/booking/checkout-context'

/**
 * When the user lands on the booking page with ?error=reservation_expired,
 * calls the expire API for the current reservation (from checkout context) so
 * status is updated to cancelled even if the cron is not running.
 */
export function ReservationExpiredHandler() {
  const searchParams = useSearchParams()
  const { checkoutData, isHydrated } = useCheckout()
  const hasCalledExpire = useRef(false)

  useEffect(() => {
    if (!isHydrated || hasCalledExpire.current) return
    if (searchParams.get('error') !== 'reservation_expired') return
    const reservationId = checkoutData.reservationId
    if (!reservationId) return

    hasCalledExpire.current = true
    fetch('/api/guest/reservations/expire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservation_id: reservationId }),
    }).catch(() => {
      // Fire-and-forget; cron will clean up if this fails
    })
  }, [isHydrated, searchParams, checkoutData.reservationId])

  return null
}

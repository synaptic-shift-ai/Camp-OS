'use client'

/**
 * Checkout Timer Component
 *
 * Displays a countdown timer showing how long the user has to complete payment.
 * When time expires, redirects to booking page with error message.
 *
 * Inspired by airline booking systems (Expedia, Southwest, etc.)
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Clock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CheckoutTimerProps {
  reservedUntil: string // ISO timestamp
  propertySlug: string // For redirect on expiration
  reservationId?: string | undefined // When set, expire API is called on timeout (fallback when cron is not running)
  onExpired?: (() => void) | undefined // Optional callback
}

export function CheckoutTimer({ reservedUntil, propertySlug, reservationId, onExpired }: CheckoutTimerProps) {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const expiredViaTimerRef = useRef(false)
  const [displayExpired, setDisplayExpired] = useState(false)

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const expirationTime = new Date(reservedUntil).getTime()
      const difference = expirationTime - now

      return Math.max(0, Math.floor(difference / 1000)) // Convert to seconds
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft())

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeLeft()
      setTimeLeft(remaining)

      if (remaining === 0 && !expiredViaTimerRef.current) {
        expiredViaTimerRef.current = true
        setDisplayExpired(true)
        onExpired?.()

        const expireAndRedirect = async () => {
          if (reservationId) {
            try {
              await fetch('/api/guest/reservations/expire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservation_id: reservationId }),
              })
            } catch {
              // Fire-and-forget; cron will clean up if this fails
            }
          }
          setTimeout(() => {
            router.push(`/book/${propertySlug}?error=reservation_expired`)
          }, 3000)
        }
        expireAndRedirect()
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      if (!expiredViaTimerRef.current && reservationId) {
        fetch('/api/guest/reservations/expire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservation_id: reservationId }),
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [reservedUntil, router, propertySlug, reservationId, onExpired])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  // Format time as MM:SS
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  // Determine urgency styling
  const isUrgent = timeLeft < 300 // Less than 5 minutes
  const isCritical = timeLeft < 60 // Less than 1 minute

  if (displayExpired) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Your reservation has expired. Redirecting you back to select a new site...
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert
      variant={isCritical ? 'destructive' : isUrgent ? 'default' : 'default'}
      className={`mb-6 ${
        isCritical
          ? 'border-red-500 bg-red-50'
          : isUrgent
          ? 'border-orange-500 bg-orange-50'
          : 'border-blue-500 bg-blue-50'
      }`}
    >
      <Clock className={`h-4 w-4 ${isCritical ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-blue-600'}`} />
      <AlertDescription className={isCritical ? 'text-red-900' : isUrgent ? 'text-orange-900' : 'text-blue-900'}>
        <div className="flex items-center justify-between">
          <span className="font-medium">
            {isCritical
              ? '⚠️ Hurry! Your reservation expires soon'
              : isUrgent
              ? 'Complete your booking soon'
              : 'Your site is reserved for'}
          </span>
          <span className={`text-2xl font-bold tabular-nums ${isCritical ? 'text-red-600 animate-pulse' : ''}`}>
            {formattedTime}
          </span>
        </div>
        <p className="text-sm mt-1">
          {isCritical
            ? 'Complete payment now or this site will be released to other guests.'
            : 'This site is held exclusively for you. Please complete payment to confirm your booking.'}
        </p>
      </AlertDescription>
    </Alert>
  )
}

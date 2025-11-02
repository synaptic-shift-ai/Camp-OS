"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"

/**
 * Onboarding redirect page
 *
 * This page handles two scenarios:
 * 1. Magic link from email (with token): Validates token and auto-authenticates user
 * 2. Direct access: Redirects to wizard if already authenticated
 */
export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')

    if (token) {
      // User clicked magic link from email - verify and authenticate
      handleMagicLinkAuth(token)
    } else {
      // Direct access - redirect to wizard (requires authentication via middleware)
      router.push("/dashboard/sites?wizard=true")
    }
  }, [router, searchParams])

  async function handleMagicLinkAuth(token: string) {
    setIsVerifying(true)
    setError(null)

    try {
      console.log('[Onboarding] Verifying magic link token...')

      const response = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Token verification failed')
      }

      const data = await response.json()
      console.log('[Onboarding] ✓ Token verified, redirecting to auth URL...')

      // Redirect to the magic link auth URL which will authenticate the user
      // and then redirect to the wizard
      window.location.href = data.authUrl
    } catch (err) {
      console.error('[Onboarding] ❌ Magic link verification failed:', err)
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        {error ? (
          <>
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Authentication Failed</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <p className="text-sm text-muted-foreground">
                Please try signing in manually or contact support if this persists.
              </p>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">
              {isVerifying ? 'Authenticating...' : 'Redirecting to setup wizard...'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

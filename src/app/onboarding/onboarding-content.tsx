"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, AlertCircle, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { PropertyProvider } from "@/components/property-context"
import { WizardContainer } from "@/components/dashboard/setup-wizard/wizard-container"
import type { WizardStep } from "@/components/dashboard/setup-wizard/wizard-progress-bar"

export default function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)
  const [linkInvalidReason, setLinkInvalidReason] = useState<"already_completed" | "already_used" | "expired" | "invalid" | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [showWizard, setShowWizard] = useState<{
    propertyId: string
    initialStep: WizardStep | "dashboard_tour"
  } | null>(null)

  const WIZARD_STEPS = [
    "property_details",
    "sites_setup",
    "stripe_connect",
    "review_launch",
  ]

  useEffect(() => {
    const hash = window.location.hash
    const token = searchParams.get("token")

    if (hash && hash.includes("access_token")) {
      handleHashAuth()
      return
    }
    if (token) {
      verifyOnboardingToken(token)
      return
    }
    resolveAndRedirect()
  }, [searchParams])

  async function verifyOnboardingToken(token: string) {
    setIsVerifying(true)
    setError(null)
    setLinkInvalidReason(null)
    try {
      const res = await fetch("/api/auth/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (res.ok && data.authUrl) {
        window.location.href = data.authUrl
        return
      }
      setLinkInvalidReason(data.reason || "invalid")
      setError(data.error || "This link is no longer valid.")
    } catch {
      setLinkInvalidReason("invalid")
      setError("Something went wrong. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleHashAuth() {
    setIsVerifying(true)
    setError(null)

    try {
      // Supabase JS client automatically picks up #access_token from the URL hash
      const { data, error } = await supabase.auth.getSession()

      if (error) throw error

      if (data.session) {
        console.log('[Onboarding] ✓ Session established from magic link')
        // Clear the hash from URL for cleanliness
        window.history.replaceState(null, '', window.location.pathname)
        await resolveAndRedirect()
      } else {
        throw new Error('No session established')
      }
    } catch (err) {
      console.error('[Onboarding] ❌ Magic link auth failed:', err)
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setIsVerifying(false)
    }
  }

  async function resolveAndRedirect() {
    try {
      const res = await fetch("/api/onboarding/has-company")
      const data = res.ok
        ? await res.json()
        : { hasCompany: false, propertyId: null, onboardingStep: null, onboardingCompleted: false }

      if (!data.hasCompany) {
        router.push("/company-details")
        return
      }
      if (data.onboardingCompleted) {
        router.push("/dashboard")
        return
      }
      if (data.onboardingStep === "company_details") {
        router.push("/company-details")
        return
      }
      if (data.hasCompany && data.propertyId) {
        const rawStep = data.onboardingStep === "dashboard_tour" ? "stripe_connect" : data.onboardingStep
        const step: WizardStep | "dashboard_tour" =
          rawStep && WIZARD_STEPS.includes(rawStep)
            ? (rawStep as WizardStep | "dashboard_tour")
            : "property_details"
        setShowWizard({ propertyId: data.propertyId, initialStep: step })
      } else {
        router.push("/company-details")
      }
    } catch {
      router.push("/company-details")
    }
  }

  if (showWizard) {
    return (
      <PropertyProvider>
        <WizardContainer
          initialPropertyId={showWizard.propertyId}
          initialStep={showWizard.initialStep}
        />
      </PropertyProvider>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        {linkInvalidReason ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <Clock className="h-10 w-10 text-amber-600 dark:text-amber-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {linkInvalidReason === "already_completed"
                ? "Onboarding already complete"
                : linkInvalidReason === "already_used"
                  ? "Link already used"
                  : linkInvalidReason === "expired"
                    ? "Link expired"
                    : "Link no longer valid"}
            </h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground mb-6">
              {linkInvalidReason === "already_completed"
                ? "Sign in to access your dashboard."
                : "Please sign in to continue."}
            </p>
            <Button asChild className="neumorphic-button-primary">
              <Link href="/login">Go to Login</Link>
            </Button>
          </>
        ) : error ? (
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
              {isVerifying ? "Authenticating..." : "Redirecting..."}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
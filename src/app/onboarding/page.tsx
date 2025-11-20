import { Suspense } from "react"
import OnboardingContent from "./onboarding-content"
import { Loader2 } from "lucide-react"

/**
 * Onboarding page
 *
 * This page handles two scenarios:
 * 1. Magic link from email (with token): Validates token and auto-authenticates user
 * 2. Direct access: Redirects to wizard if already authenticated
 *
 * Wrapped in Suspense to satisfy Next.js 15 requirements for useSearchParams()
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingContent />
    </Suspense>
  )
}

function OnboardingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

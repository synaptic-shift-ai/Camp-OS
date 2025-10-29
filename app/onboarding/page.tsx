"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * Onboarding redirect page
 *
 * This page redirects to the new multi-step wizard flow at /dashboard/sites?wizard=true
 * The wizard will automatically select the first incomplete property for setup.
 */
export default function OnboardingPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new wizard flow
    // The wizard will auto-select the first incomplete property via setup-check-gate
    router.push("/dashboard/sites?wizard=true")
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Redirecting to setup wizard...</p>
      </div>
    </div>
  )
}

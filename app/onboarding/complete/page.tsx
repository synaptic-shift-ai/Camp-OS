import { Suspense } from "react"
import { OnboardingCompleteClient } from "@/components/onboarding-complete-client"
import { Loader2 } from "lucide-react"

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function OnboardingCompletePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OnboardingCompleteClient />
    </Suspense>
  )
}

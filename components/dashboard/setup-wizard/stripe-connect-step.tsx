"use client"

import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { CreditCard } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface StripeConnectStepProps {
  property: Property
  onComplete: () => void
  onSkip: () => void
}

export function StripeConnectStep({ property, onComplete, onSkip }: StripeConnectStepProps) {
  const isStripeConnected = !!property.stripe_connected_at

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Payment Setup</h2>
          <p className="text-muted-foreground">
            Connect Stripe to accept payments for {property.name}
          </p>
        </div>
      </div>

      {isStripeConnected ? (
        <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <AlertDescription className="text-green-900 dark:text-green-100">
            Stripe is already connected for this property!
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
          <p className="text-muted-foreground">
            Stripe Connect integration will be implemented in Phase 6
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            This will wrap the existing Stripe Connect flow from the onboarding
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onComplete}>
          {isStripeConnected ? "Continue to Review" : "Connect Stripe Later"}
        </Button>
        {!isStripeConnected && (
          <Button variant="outline" onClick={onSkip}>
            Skip for Now
          </Button>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  CreditCard,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from "lucide-react"

interface StripeConnectStepProps {
  property: Property
  onComplete: () => void
  onSkip: () => void
}

export function StripeConnectStep({ property, onComplete, onSkip }: StripeConnectStepProps) {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const searchParams = useSearchParams()

  const isStripeConnected = !!property.stripe_connected_at
  const stripeConnectedParam = searchParams.get("stripe_connected")
  const errorParam = searchParams.get("error")

  // Show success message if just connected
  useEffect(() => {
    if (stripeConnectedParam === "true") {
      // Auto-advance after showing success
      const timer = setTimeout(() => {
        onComplete()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [stripeConnectedParam, onComplete])

  const handleStripeConnect = () => {
    setConnecting(true)

    try {
      // Generate state with propertyId for OAuth callback
      const state = JSON.stringify({
        propertyId: property.id,
        timestamp: Date.now(),
      })

      // Get Stripe Connect client ID from environment
      const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID

      if (!clientId) {
        console.error("Missing NEXT_PUBLIC_STRIPE_CLIENT_ID environment variable")
        alert("Stripe Connect is not configured. Please contact support.")
        setConnecting(false)
        return
      }

      // Build OAuth redirect URI
      const redirectUri = `${window.location.origin}/api/stripe/connect/authorize`

      // Build Stripe OAuth URL
      const stripeOAuthUrl = new URL("https://connect.stripe.com/oauth/authorize")
      stripeOAuthUrl.searchParams.set("client_id", clientId)
      stripeOAuthUrl.searchParams.set("state", state)
      stripeOAuthUrl.searchParams.set("redirect_uri", redirectUri)
      stripeOAuthUrl.searchParams.set("response_type", "code")
      stripeOAuthUrl.searchParams.set("scope", "read_write")

      // Redirect to Stripe OAuth
      window.location.href = stripeOAuthUrl.toString()
    } catch (error) {
      console.error("Error initiating Stripe Connect:", error)
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this Stripe account? You can reconnect anytime.")) {
      return
    }

    setDisconnecting(true)

    try {
      const response = await fetch(`/api/dashboard/properties/${property.id}/stripe-disconnect`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to disconnect Stripe")
      }

      // Reload page to refresh property data
      window.location.reload()
    } catch (error) {
      console.error("Error disconnecting Stripe:", error)
      alert("Failed to disconnect Stripe. Please try again.")
      setDisconnecting(false)
    }
  }

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

      {/* Error Alert */}
      {errorParam && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {errorParam === "oauth_failed" && "Stripe connection failed. Please try again."}
            {errorParam === "invalid_state" && "Invalid OAuth state. Please try again."}
            {errorParam === "unauthorized" && "Unauthorized. Please sign in and try again."}
            {errorParam === "property_not_found" && "Property not found. Please try again."}
            {errorParam === "update_failed" && "Failed to save Stripe account. Please try again."}
            {errorParam === "exchange_failed" && "Failed to connect to Stripe. Please try again."}
            {!["oauth_failed", "invalid_state", "unauthorized", "property_not_found", "update_failed", "exchange_failed"].includes(errorParam) &&
              "An error occurred. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {stripeConnectedParam === "true" && (
        <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
          <AlertDescription className="text-green-900 dark:text-green-100">
            Stripe connected successfully! Redirecting to next step...
          </AlertDescription>
        </Alert>
      )}

      {isStripeConnected && !stripeConnectedParam ? (
        <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-500" />
              <div>
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  Stripe Connected
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  This property is ready to accept payments
                </p>
              </div>
            </div>

            <Separator className="bg-green-200 dark:bg-green-900" />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Need to switch to a different Stripe account?
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reconnect
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        !stripeConnectedParam && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Benefits List */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Secure & Trusted</h3>
                    <p className="text-sm text-muted-foreground">
                      Powered by Stripe - trusted by millions of businesses worldwide
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Fast Payouts</h3>
                    <p className="text-sm text-muted-foreground">
                      Receive funds directly to your bank account in 2-3 business days
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Simple Pricing</h3>
                    <p className="text-sm text-muted-foreground">
                      2.9% + $0.30 per transaction - no hidden fees or monthly costs
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Your Account, Your Control</h3>
                    <p className="text-sm text-muted-foreground">
                      Payments go directly to your Stripe account - you maintain full control
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Connect Button */}
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleStripeConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Connecting to Stripe...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Connect with Stripe
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  You'll be redirected to Stripe to complete the connection
                </p>
              </div>

              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  Don't have a Stripe account?{" "}
                  <a
                    href="https://stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Create one for free
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={onSkip} disabled={connecting || disconnecting}>
          Skip for Now
        </Button>

        {isStripeConnected && !stripeConnectedParam && (
          <Button onClick={onComplete} disabled={connecting || disconnecting}>
            Continue to Dashboard Tour
          </Button>
        )}

        {!isStripeConnected && !stripeConnectedParam && (
          <Button variant="ghost" onClick={onComplete} disabled={connecting}>
            I'll Connect Later
          </Button>
        )}
      </div>

      {!isStripeConnected && (
        <Alert>
          <AlertDescription className="text-sm">
            <strong>Note:</strong> You can skip this step and connect Stripe later from your property
            settings. However, you won't be able to accept online bookings until Stripe is connected.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

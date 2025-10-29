"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  CreditCard,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Building2,
} from "lucide-react"

interface PropertyWithStatus {
  id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  phone: string | null
  email: string | null
  bookingPageSlug: string | null
  stripeConnected: boolean
  stripeConnectedAt: string | null
  bookingPageUrl: string
  sites: any[]
  totalSites: number
  siteBreakdown: string
  isConnecting?: boolean
  isDisconnecting?: boolean
}

interface StripeConnectStepProps {
  property: Property
  onComplete: () => void
  onSkip: () => void
}

export function StripeConnectStep({ property, onComplete, onSkip }: StripeConnectStepProps) {
  const [properties, setProperties] = useState<PropertyWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()

  const stripeConnectedParam = searchParams.get("stripe_connected")
  const errorParam = searchParams.get("error")

  // Fetch all properties for the user
  useEffect(() => {
    async function fetchProperties() {
      try {
        const response = await fetch("/api/onboarding/completion-status")
        const data = await response.json()
        setProperties(data.properties || [])
      } catch (error) {
        console.error("Error fetching properties:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchProperties()
  }, [])

  // Reload properties after successful connection
  useEffect(() => {
    if (stripeConnectedParam === "true") {
      // Reload properties to show updated status
      async function reloadProperties() {
        try {
          const response = await fetch("/api/onboarding/completion-status")
          const data = await response.json()
          setProperties(data.properties || [])
        } catch (error) {
          console.error("Error reloading properties:", error)
        }
      }
      reloadProperties()
    }
  }, [stripeConnectedParam])

  const handleStripeConnect = (propertyId: string) => {
    // Mark this property as connecting
    setProperties(prev => prev.map(p =>
      p.id === propertyId ? { ...p, isConnecting: true } : p
    ))

    try {
      // Generate state with propertyId for OAuth callback
      const state = JSON.stringify({
        propertyId,
        timestamp: Date.now(),
      })

      // Get Stripe Connect client ID from environment
      const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID

      if (!clientId) {
        console.error("Missing NEXT_PUBLIC_STRIPE_CLIENT_ID environment variable")
        alert("Stripe Connect is not configured. Please contact support.")
        setProperties(prev => prev.map(p =>
          p.id === propertyId ? { ...p, isConnecting: false } : p
        ))
        return
      }

      // Build OAuth redirect URI - return to this wizard step
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
      setProperties(prev => prev.map(p =>
        p.id === propertyId ? { ...p, isConnecting: false } : p
      ))
    }
  }

  const handleDisconnect = async (propertyId: string) => {
    if (!confirm("Are you sure you want to disconnect this Stripe account? You can reconnect anytime.")) {
      return
    }

    // Mark this property as disconnecting
    setProperties(prev => prev.map(p =>
      p.id === propertyId ? { ...p, isDisconnecting: true } : p
    ))

    try {
      const response = await fetch(`/api/dashboard/properties/${propertyId}/stripe-disconnect`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to disconnect Stripe")
      }

      // Reload properties to show updated status
      const reloadResponse = await fetch("/api/onboarding/completion-status")
      const data = await reloadResponse.json()
      setProperties(data.properties || [])
    } catch (error) {
      console.error("Error disconnecting Stripe:", error)
      alert("Failed to disconnect Stripe. Please try again.")
      setProperties(prev => prev.map(p =>
        p.id === propertyId ? { ...p, isDisconnecting: false } : p
      ))
    }
  }

  const connectedCount = properties.filter(p => p.stripeConnected).length
  const totalCount = properties.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Payment Setup</h2>
          <p className="text-muted-foreground">
            Connect Stripe to accept payments for your {totalCount === 1 ? "property" : "properties"}
          </p>
        </div>
        {totalCount > 0 && (
          <Badge variant="outline" className="text-base px-4 py-2">
            {connectedCount} of {totalCount} Connected
          </Badge>
        )}
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
            Stripe connected successfully! You can connect more properties below or continue.
          </AlertDescription>
        </Alert>
      )}

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Secure & Trusted</h3>
                <p className="text-xs text-muted-foreground">
                  Powered by Stripe - trusted by millions worldwide
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Fast Payouts</h3>
                <p className="text-xs text-muted-foreground">
                  Funds to your bank in 2-3 business days
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Simple Pricing</h3>
                <p className="text-xs text-muted-foreground">
                  2.9% + $0.30 per transaction
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Your Control</h3>
                <p className="text-xs text-muted-foreground">
                  Payments go directly to your account
                </p>
              </div>
            </div>
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

      {/* Properties List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Properties</h3>
        {properties.map((prop) => {
          const isConnected = prop.stripeConnected
          const isLoading = prop.isConnecting || prop.isDisconnecting

          return (
            <Card key={prop.id} className={isConnected ? "border-green-200 dark:border-green-800" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{prop.name}</CardTitle>
                      {prop.address && (
                        <p className="text-sm text-muted-foreground">{prop.address}</p>
                      )}
                    </div>
                  </div>
                  {isConnected && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {isConnected ? (
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                    <p className="text-sm text-green-900 dark:text-green-100">
                      Ready to accept payments
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(prop.id)}
                      disabled={isLoading}
                    >
                      {prop.isDisconnecting ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Reconnect
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleStripeConnect(prop.id)}
                    disabled={isLoading}
                  >
                    {prop.isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting to Stripe...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Connect Stripe for {prop.name}
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={onSkip}>
          Skip for Now
        </Button>

        <Button onClick={onComplete}>
          Continue to Dashboard Tour
        </Button>
      </div>

      <Alert>
        <AlertDescription className="text-sm">
          <strong>Note:</strong> You can skip this step and connect Stripe later from your property
          settings. However, you won't be able to accept online bookings until Stripe is connected.
          {connectedCount > 0 && connectedCount < totalCount && (
            <> You've connected {connectedCount} of {totalCount} properties - you can connect the remaining properties now or later.</>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}

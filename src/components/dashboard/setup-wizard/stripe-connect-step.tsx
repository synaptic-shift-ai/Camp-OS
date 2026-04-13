"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { getApiFailureMessage } from "@/lib/api/get-api-failure-message"

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

export function StripeConnectStep({ property: _property, onComplete, onSkip }: StripeConnectStepProps) {
  const [properties, setProperties] = useState<PropertyWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()

  const stripeConnectedParam = searchParams.get("stripe_connected")
  const errorParam = searchParams.get("error")

  // Fetch all properties for the user (only on initial mount)
  useEffect(() => {
    // Skip if we already have properties loaded
    if (properties.length > 0) {
      setLoading(false)
      return
    }

    async function fetchProperties() {
      try {
        // Migrated to v1 API (Phase 4, Week 13-14)
        const response = await fetch("/api/v1/properties")
        const result = await response.json()
        // v1 API returns { success: true, data: { items: [...], pagination: {...} } }
        const items = result.success && result.data?.items ? result.data.items : []
        setProperties(items)
      } catch (error) {
        console.error("Error fetching properties:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchProperties()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Reload properties after successful connection
  useEffect(() => {
    if (stripeConnectedParam === "true") {
      // Reload properties to show updated status
      async function reloadProperties() {
        try {
          // Migrated to v1 API (Phase 4, Week 13-14)
          const response = await fetch("/api/v1/properties")
          const result = await response.json()
          // v1 API returns { success: true, data: { items: [...], pagination: {...} } }
          const items = result.success && result.data?.items ? result.data.items : []
          setProperties(items)
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
        redirectPath: "/onboarding?step=stripe_connect",
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
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      const redirectUri = `${baseUrl}/api/stripe/connect/authorize`
      console.log(`redirectUri: ${redirectUri}`)


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
      // Migrated to v1 API (Phase 4, Week 13-14)
      const response = await fetch(`/api/v1/properties/${propertyId}/stripe-account`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(getApiFailureMessage(result) || "Failed to disconnect Stripe")
      }

      // Reload properties to show updated status
      const reloadResponse = await fetch("/api/v1/properties")
      const reloadResult = await reloadResponse.json()
      // v1 API returns { success: true, data: { items: [...], pagination: {...} } }
      const reloadedItems = reloadResult.success && reloadResult.data?.items ? reloadResult.data.items : []
      setProperties(reloadedItems)
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

  const features = [
    {
      title: "Secure & Trusted",
      description: "Powered by Stripe - trusted by millions worldwide",
    },
    {
      title: "Fast Payouts",
      description: "Funds to your bank in 2-3 business days",
    },
    {
      title: "Simple Pricing",
      description: "2.9% + $0.30 per transaction",
    },
    {
      title: "Your Control",
      description: "Payments go directly to your account",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header: title + subtitle + badge */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">Payment setup</h2>
          {totalCount > 0 && (
            <Badge variant="outline" className="text-sm px-3 py-1 shrink-0">
              {connectedCount} of {totalCount} connected
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Connect Stripe to accept payments for your {totalCount === 1 ? "property" : "properties"}
        </p>
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

      {/* Features block — horizontal strip, 4 items */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {features.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4 text-center">
          Don&apos;t have a Stripe account?{" "}
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

      {/* Properties List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your properties</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                          Connect Stripe
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Alert className="flex-1 min-w-0 border-blue-500/30 bg-blue-500/10 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400">
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> You won&apos;t be able to accept online bookings until Stripe is
            connected for a property. Connect Stripe for each property above, or connect later from
            your property settings.
            {connectedCount > 0 && connectedCount < totalCount && (
              <> You&apos;ve connected {connectedCount} of {totalCount} properties; connect the remaining when ready.</>
            )}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

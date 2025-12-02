"use client"

import { useState, useEffect } from "react"
import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Rocket, CheckCircle2, XCircle, MapPin, Tent, CreditCard, Mail, Phone, Building2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ReviewLaunchStepProps {
  property: Property
  onComplete: () => void
}

interface Site {
  id: string
  property_id: string
  site_number: string
  site_name: string | null
  site_type: string
  base_price: number
  status: string
}

interface PropertyData {
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
  sites: Site[]
  totalSites: number
  siteBreakdown: string
}

interface CompletionData {
  properties: PropertyData[]
  summary: {
    totalProperties: number
    totalSites: number
    propertiesWithStripe: number
    allStripeConnected: boolean
  }
}

export function ReviewLaunchStep({ property, onComplete }: ReviewLaunchStepProps) {
  const [completionData, setCompletionData] = useState<CompletionData | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch completion status - migrated to v1 API
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/v1/properties/${property.id}/completion-status`)
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Failed to fetch completion status")
        }

        // v1 API returns { success: true, data: { properties: [...], summary: {...} } }
        setCompletionData(result.data)
      } catch (error) {
        console.error("Error fetching completion data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [property.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!completionData) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Unable to load completion status. Please try again.
        </AlertDescription>
      </Alert>
    )
  }

  const { properties, summary } = completionData

  // Check if all properties are ready to launch
  const allPropertiesReady = properties.every(
    (prop) =>
      prop.address &&
      prop.city &&
      prop.state &&
      prop.totalSites > 0 &&
      prop.stripeConnected
  )

  // Count incomplete properties
  const incompleteProperties = properties.filter(
    (prop) => !prop.address || !prop.city || !prop.state || prop.totalSites === 0 || !prop.stripeConnected
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Rocket className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Review & Launch</h2>
          <p className="text-muted-foreground">
            Review your setup and launch your {summary.totalProperties === 1 ? "property" : "properties"}
          </p>
        </div>
        {summary.totalProperties > 0 && (
          <Badge variant="outline" className="text-base px-4 py-2">
            {summary.totalProperties} {summary.totalProperties === 1 ? "Property" : "Properties"}
          </Badge>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{summary.totalProperties}</p>
                <p className="text-sm text-muted-foreground">
                  {summary.totalProperties === 1 ? "Property" : "Properties"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Tent className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{summary.totalSites}</p>
                <p className="text-sm text-muted-foreground">
                  Total {summary.totalSites === 1 ? "Site" : "Sites"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  summary.allStripeConnected
                    ? "bg-green-100 dark:bg-green-900/20"
                    : "bg-amber-100 dark:bg-amber-900/20"
                }`}
              >
                <CreditCard
                  className={`h-6 w-6 ${
                    summary.allStripeConnected ? "text-green-600" : "text-amber-600"
                  }`}
                />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {summary.propertiesWithStripe}/{summary.totalProperties}
                </p>
                <p className="text-sm text-muted-foreground">Payment Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Properties List */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Your Properties</h3>
        {properties.map((prop) => {
          const hasBasicInfo = !!(prop.address && prop.city && prop.state)
          const hasSites = prop.totalSites > 0
          const hasStripe = prop.stripeConnected
          const isComplete = hasBasicInfo && hasSites && hasStripe

          return (
            <Card key={prop.id} className={isComplete ? "border-green-200 dark:border-green-800" : "border-amber-200 dark:border-amber-800"}>
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{prop.name}</CardTitle>
                  {isComplete ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ready to Launch
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-amber-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Incomplete
                    </Badge>
                  )}
                </div>
                {prop.description && (
                  <CardDescription className="mt-2">{prop.description}</CardDescription>
                )}
              </CardHeader>

              <CardContent className="pt-6 space-y-4">
                {/* Property Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Address</p>
                      {hasBasicInfo ? (
                        <p className="text-muted-foreground">
                          {prop.address}
                          <br />
                          {prop.city}, {prop.state} {prop.zipCode}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Not configured</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Contact</p>
                      {prop.phone && <p className="text-muted-foreground">{prop.phone}</p>}
                      {prop.email && <p className="text-muted-foreground">{prop.email}</p>}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sites */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Tent className="h-4 w-4" />
                      Sites ({prop.totalSites})
                    </h4>
                    {hasSites ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  {hasSites ? (
                    <p className="text-sm text-muted-foreground">{prop.siteBreakdown}</p>
                  ) : (
                    <p className="text-sm text-amber-600 dark:text-amber-400">No sites configured</p>
                  )}
                </div>

                <Separator />

                {/* Payment */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Processing
                    </h4>
                    {hasStripe ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  {hasStripe ? (
                    <p className="text-sm text-muted-foreground">Stripe connected and ready</p>
                  ) : (
                    <p className="text-sm text-amber-600 dark:text-amber-400">Stripe not connected</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Launch Status */}
      {allPropertiesReady ? (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-lg text-green-900 dark:text-green-100">
                  {summary.totalProperties === 1 ? "Your property is" : "All properties are"} ready to launch!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  All required setup steps are complete. Click "Complete Setup" below to start accepting bookings for {summary.totalProperties === 1 ? "your property" : `all ${summary.totalProperties} properties`}.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>{summary.totalProperties} {summary.totalProperties === 1 ? "property" : "properties"} configured</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>{summary.totalSites} {summary.totalSites === 1 ? "site" : "sites"} ready for booking</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Payment processing enabled for all properties</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Booking pages published</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-lg text-amber-900 dark:text-amber-100">
                  Setup incomplete
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                  {incompleteProperties.length === 1
                    ? "1 property needs"
                    : `${incompleteProperties.length} properties need`} additional configuration. Please complete the required steps for all properties before launching.
                </p>
                <div className="mt-4 space-y-2">
                  {incompleteProperties.map((prop) => (
                    <div key={prop.id} className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-amber-600" />
                      <span>{prop.name} — {!prop.address || !prop.city || !prop.state ? "Missing property details" : !prop.totalSites ? "No sites configured" : "Stripe not connected"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end">
        <Button onClick={onComplete} disabled={!allPropertiesReady} size="lg">
          <Rocket className="mr-2 h-5 w-5" />
          Complete Setup
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Rocket, CheckCircle2, XCircle, MapPin, Tent, CreditCard, Globe, Mail, Phone } from "lucide-react"
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

export function ReviewLaunchStep({ property, onComplete }: ReviewLaunchStepProps) {
  const [sites, setSites] = useState<Site[]>([])
  const [isLoadingSites, setIsLoadingSites] = useState(true)

  // Check property completion status
  const hasBasicInfo = !!(property.address && property.city && property.state)
  const hasSites = (property.site_count || 0) > 0
  const hasStripe = !!property.stripe_connected_at
  const hasBookingSlug = !!property.booking_page_slug

  const readyToLaunch = hasBasicInfo && hasSites && hasStripe

  // Fetch sites for this property
  useEffect(() => {
    const fetchSites = async () => {
      try {
        setIsLoadingSites(true)
        const response = await fetch(`/api/admin/sites`)

        if (response.ok) {
          const data = await response.json()
          // Filter sites for current property
          const propertySites = data.sites?.filter((site: Site) => site.property_id === property.id) || []
          setSites(propertySites)
        }
      } catch (error) {
        console.error("Failed to fetch sites:", error)
      } finally {
        setIsLoadingSites(false)
      }
    }

    fetchSites()
  }, [property.id])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Rocket className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Review & Launch</h2>
          <p className="text-muted-foreground">
            Review your setup and launch {property.name}
          </p>
        </div>
      </div>

      {/* Property Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Property Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{property.name}</h3>
            {property.description && (
              <p className="text-sm text-muted-foreground mt-1">{property.description}</p>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Address</p>
                <p className="text-muted-foreground">
                  {property.address}
                  <br />
                  {property.city}, {property.state} {property.zip_code}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Contact</p>
                <p className="text-muted-foreground">{property.phone}</p>
                <p className="text-muted-foreground">{property.email}</p>
              </div>
            </div>
          </div>

          {hasBookingSlug && (
            <>
              <Separator />
              <div className="flex items-start gap-2">
                <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Booking Page</p>
                  <a
                    href={`/book/${property.booking_page_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {window.location.origin}/book/{property.booking_page_slug}
                  </a>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sites Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tent className="h-5 w-5" />
            Sites Configuration
            {hasSites && (
              <Badge variant="secondary" className="ml-2">
                {property.site_count} {property.site_count === 1 ? "site" : "sites"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingSites ? (
            <p className="text-sm text-muted-foreground">Loading sites...</p>
          ) : sites.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sites.map((site) => (
                <div
                  key={site.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">#{site.site_number}</span>
                    <Badge variant="outline" className="text-xs">
                      {site.site_type}
                    </Badge>
                  </div>
                  {site.site_name && (
                    <p className="text-sm text-muted-foreground">{site.site_name}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      ${(site.base_price / 100).toFixed(2)}/night
                    </span>
                    <Badge
                      variant={site.status === "available" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {site.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                No sites configured. Please go back and add at least one site.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Payment Setup Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Processing
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasStripe ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Stripe Connected</p>
                <p className="text-sm text-muted-foreground">
                  Ready to accept credit cards, debit cards, and digital wallets
                </p>
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Stripe not connected. Please go back and connect your Stripe account.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Launch Status */}
      {readyToLaunch ? (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-lg text-green-900 dark:text-green-100">
                  Your property is ready to launch!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  All required setup steps are complete. Click "Complete Setup" below to start accepting bookings.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Property details configured</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>{property.site_count} sites ready for booking</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Payment processing enabled</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Booking page published</span>
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
              <XCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-lg text-amber-900 dark:text-amber-100">
                  Setup incomplete
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                  Please complete the required steps above before launching your property.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {hasBasicInfo ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <span>Property details</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {hasSites ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <span>Sites configuration</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {hasStripe ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <span>Payment processing</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={onComplete} disabled={!readyToLaunch} size="lg" className="flex-1">
          <Rocket className="mr-2 h-5 w-5" />
          Complete Setup
        </Button>
        {hasBookingSlug && (
          <Button variant="outline" size="lg" asChild>
            <a href={`/book/${property.booking_page_slug}`} target="_blank" rel="noopener noreferrer">
              <Globe className="mr-2 h-4 w-4" />
              Preview Booking Page
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

"use client"

import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Rocket, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ReviewLaunchStepProps {
  property: Property
  onComplete: () => void
}

export function ReviewLaunchStep({ property, onComplete }: ReviewLaunchStepProps) {
  // Check property completion status
  const hasBasicInfo = !!(property.address && property.city && property.state)
  const hasSites = (property.site_count || 0) > 0
  const hasStripe = !!property.stripe_connected_at
  const hasBookingSlug = !!property.booking_page_slug

  const readyToLaunch = hasBasicInfo && hasSites && hasStripe

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

      {/* Setup Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Checklist</CardTitle>
          <CardDescription>Verify all required configurations are complete</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasBasicInfo ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">Property Information</span>
            </div>
            <Badge variant={hasBasicInfo ? "default" : "destructive"}>
              {hasBasicInfo ? "Complete" : "Incomplete"}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasSites ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">Sites Configuration</span>
            </div>
            <Badge variant={hasSites ? "default" : "destructive"}>
              {hasSites ? `${property.site_count} sites` : "No sites"}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasStripe ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">Payment Processing</span>
            </div>
            <Badge variant={hasStripe ? "default" : "destructive"}>
              {hasStripe ? "Connected" : "Not connected"}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasBookingSlug ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">Booking Page</span>
            </div>
            <Badge variant={hasBookingSlug ? "default" : "secondary"}>
              {hasBookingSlug ? "Ready" : "Auto-generated"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Launch Actions */}
      {readyToLaunch ? (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-900 dark:text-green-100">
                  All set! Your property is ready to accept bookings.
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Click "Launch Property" to mark setup as complete and start accepting reservations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  Setup incomplete
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Please complete the required steps above before launching your property.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={onComplete} disabled={!readyToLaunch} size="lg">
          <Rocket className="mr-2 h-5 w-5" />
          Launch Property
        </Button>
        {hasBookingSlug && (
          <Button variant="outline" size="lg" asChild>
            <a href={`/book/${property.booking_page_slug}`} target="_blank" rel="noopener noreferrer">
              Preview Booking Page
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

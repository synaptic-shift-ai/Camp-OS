"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Building2,
  Tent,
  CreditCard,
  CheckCircle2,
  Rocket,
  Loader2,
  MapPin,
  Phone,
  Globe,
  Edit,
  AlertCircle,
  TrendingUp,
  Award,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"

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

interface Site {
  id: string
  property_id: string
  site_number: string
  site_name: string | null
  site_type: string
  base_price: number
  status: string
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

export function OnboardingCompleteClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [completionData, setCompletionData] = useState<CompletionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const stripeConnected = searchParams.get("stripe_connected") === "true"

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/onboarding/completion-status")
        const data = await response.json()
        setCompletionData(data)
      } catch (error) {
        console.error("Error fetching completion data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  async function handleCompleteSetup() {
    if (!completionData?.properties || completionData.properties.length === 0) return

    setCompleting(true)

    try {
      // Mark all properties as onboarding complete
      await Promise.all(
        completionData.properties.map((property) =>
          fetch("/api/onboarding/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              propertyId: property.id,
            }),
          })
        )
      )

      // Redirect to dashboard
      router.push("/dashboard?setup_complete=true")
    } catch (error) {
      console.error("Error completing setup:", error)
      alert(`Failed to complete setup: ${error instanceof Error ? error.message : "Unknown error"}`)
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!completionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Data</CardTitle>
            <CardDescription>Unable to load completion status</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard/sites")} variant="outline" className="w-full">
              Return to Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { properties, summary } = completionData

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Tent className="h-6 w-6" />
            <span className="font-bold text-xl">CampOS</span>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Setup Complete!</h1>
            <p className="text-xl text-muted-foreground">
              Your {summary.totalProperties === 1 ? "property is" : `${summary.totalProperties} properties are`} configured and ready to launch
            </p>
          </div>

          {/* Stripe Success Alert */}
          {stripeConnected && (
            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900 dark:text-green-100">
                Stripe successfully connected! You're ready to accept payments.
              </AlertDescription>
            </Alert>
          )}

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
                      {summary.totalProperties === 1 ? "Property" : "Properties"} Configured
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
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                    summary.allStripeConnected
                      ? "bg-green-100 dark:bg-green-900/20"
                      : "bg-amber-100 dark:bg-amber-900/20"
                  }`}>
                    <CreditCard className={`h-6 w-6 ${
                      summary.allStripeConnected ? "text-green-600" : "text-amber-600"
                    }`} />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{summary.propertiesWithStripe}/{summary.totalProperties}</p>
                    <p className="text-sm text-muted-foreground">Payment Ready</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Properties List */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">Your Properties</h2>
            </div>

            {properties.map((property, index) => (
              <Card key={property.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl flex items-center gap-3">
                        {property.name}
                        {property.stripeConnected && (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Payment Ready
                          </Badge>
                        )}
                      </CardTitle>
                      {property.description && (
                        <CardDescription className="mt-2">{property.description}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {/* Property Details */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location & Contact
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {property.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Address</p>
                            <p className="text-muted-foreground">
                              {property.address}<br />
                              {property.city}, {property.state} {property.zipCode}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Contact</p>
                          {property.phone && <p className="text-muted-foreground">{property.phone}</p>}
                          {property.email && <p className="text-muted-foreground">{property.email}</p>}
                        </div>
                      </div>
                    </div>

                    {property.bookingPageSlug && (
                      <>
                        <Separator className="my-4" />
                        <div className="flex items-start gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Booking Page</p>
                            <a
                              href={property.bookingPageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                            >
                              {property.bookingPageUrl}
                            </a>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Sites */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Tent className="h-4 w-4" />
                      Sites ({property.totalSites})
                      {property.siteBreakdown && (
                        <span className="text-sm font-normal text-muted-foreground">
                          — {property.siteBreakdown}
                        </span>
                      )}
                    </h3>

                    {property.sites.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {property.sites.map((site) => (
                          <div key={site.id} className="border rounded-lg p-3 space-y-2">
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
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>No sites configured for this property</AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Payment Status */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Processing
                    </h3>
                    {property.stripeConnected ? (
                      <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-green-900 dark:text-green-100">Stripe Connected</p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Ready to accept credit cards, debit cards, and digital wallets
                          </p>
                        </div>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Payment processing not set up. Connect Stripe to accept bookings.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Preview Button */}
                  {property.bookingPageSlug && (
                    <Button
                      variant="outline"
                      className="w-full"
                      asChild
                    >
                      <a href={property.bookingPageUrl} target="_blank" rel="noopener noreferrer">
                        <Globe className="mr-2 h-4 w-4" />
                        Preview {property.name} Booking Page
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Edit Note */}
          <Alert>
            <Edit className="h-4 w-4" />
            <AlertDescription>
              <strong>Need to make changes?</strong> After completing setup, you can edit any of these
              settings using the sidebar navigation in your dashboard. Access property settings, manage
              sites, or update payment information at any time.
            </AlertDescription>
          </Alert>

          {/* Complete Setup Button */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold flex items-center justify-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Ready to Launch Your Business?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Complete your setup to access your full dashboard and start managing bookings for{" "}
                  {summary.totalProperties === 1 ? "your property" : `all ${summary.totalProperties} properties`}
                </p>
              </div>

              <Button
                onClick={handleCompleteSetup}
                disabled={completing}
                size="lg"
                className="w-full"
              >
                {completing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Completing Setup...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-5 w-5" />
                    Complete Setup & Go to Dashboard
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

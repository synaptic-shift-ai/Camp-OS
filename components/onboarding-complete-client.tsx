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
  Mail,
  Globe,
  Edit,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"

interface Property {
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
}

interface Site {
  id: string
  site_number: string
  site_name: string | null
  site_type: string
  base_price: number
  status: string
}

interface CompletionData {
  property: Property
  sites: Site[]
  totalSites: number
  siteBreakdown: string
  stripeConnected: boolean
  stripeConnectedAt: string | null
  bookingPageUrl: string
}

export function OnboardingCompleteClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [completionData, setCompletionData] = useState<CompletionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const propertyId = searchParams.get("property_id")
  const stripeConnected = searchParams.get("stripe_connected") === "true"

  useEffect(() => {
    async function fetchData() {
      try {
        const url = propertyId
          ? `/api/onboarding/completion-status?property_id=${propertyId}`
          : "/api/onboarding/completion-status"

        const response = await fetch(url)
        const data = await response.json()
        setCompletionData(data)
      } catch (error) {
        console.error("Error fetching completion data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [propertyId])

  async function handleCompleteSetup() {
    if (!completionData?.property.id) return

    setCompleting(true)

    try {
      // Mark property onboarding as complete
      const response = await fetch("/api/onboarding/update-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: completionData.property.id,
          onboardingCompleted: true,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to complete setup")
      }

      // Redirect to dashboard
      router.push("/dashboard?setup_complete=true")
    } catch (error) {
      console.error("Error completing setup:", error)
      alert("Failed to complete setup. Please try again.")
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

  const { property, sites } = completionData

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
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Setup Complete!</h1>
            <p className="text-xl text-muted-foreground">
              {property.name} is configured and ready to launch
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

          {/* Setup Summary Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Setup Summary
              </CardTitle>
              <CardDescription>
                Review everything you've configured for your property
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Property Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Property Information
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {property.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-sm text-muted-foreground">
                        {property.address}
                        <br />
                        {property.city}, {property.state} {property.zipCode}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Contact</p>
                    {property.phone && <p className="text-sm text-muted-foreground">{property.phone}</p>}
                    {property.email && <p className="text-sm text-muted-foreground">{property.email}</p>}
                  </div>
                </div>
              </div>

              {property.bookingPageSlug && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Booking Page</p>
                      <a
                        href={completionData.bookingPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {completionData.bookingPageUrl}
                      </a>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Sites Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Tent className="h-5 w-5" />
                  Sites Configured
                  <Badge variant="secondary" className="ml-2">
                    {completionData.totalSites} {completionData.totalSites === 1 ? "site" : "sites"}
                  </Badge>
                </CardTitle>
              </div>
              <CardDescription>{completionData.siteBreakdown}</CardDescription>
            </CardHeader>
            <CardContent>
              {sites.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sites.map((site) => (
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
                <p className="text-sm text-muted-foreground">No sites configured</p>
              )}
            </CardContent>
          </Card>

          {/* Payment Processing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completionData.stripeConnected ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
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
                    Payment processing not set up. You'll need to connect Stripe before accepting bookings.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

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
                <h3 className="text-lg font-semibold">Ready to Launch?</h3>
                <p className="text-sm text-muted-foreground">
                  Complete your setup to access your full dashboard and start managing bookings
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

              {property.bookingPageSlug && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  asChild
                >
                  <a
                    href={completionData.bookingPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    Preview Booking Page
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

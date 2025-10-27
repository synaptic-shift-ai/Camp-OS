"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Tent,
  DollarSign,
  CreditCard,
  CheckCircle2,
  Copy,
  ArrowRight,
  Loader2,
  BookOpen,
  Mail,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"

interface CompletionData {
  propertyName: string
  city: string
  state: string
  totalSites: number
  siteBreakdown: string
  stripeConnected: boolean
  bookingPageUrl: string
}

export function OnboardingCompleteClient() {
  const router = useRouter()
  const [completionData, setCompletionData] = useState<CompletionData | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

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

  async function handleCopyUrl() {
    if (!completionData) return
    try {
      await navigator.clipboard.writeText(completionData.bookingPageUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Error copying to clipboard:", error)
    }
  }

  function handleTestBooking() {
    if (!completionData) return
    window.open(completionData.bookingPageUrl, "_blank")
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
        <Card className="glass-strong max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Data</CardTitle>
            <CardDescription>Unable to load completion status</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/onboarding")} variant="outline" className="w-full">
              Return to Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Tent className="h-6 w-6" />
            <span className="font-bold text-xl">CampOS</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">🎉 Your Campground is Live!</h1>
            <p className="text-xl text-muted-foreground">
              Congratulations! {completionData.propertyName} is ready to accept bookings
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Step 4 of 4</span>
              <span className="text-green-600 dark:text-green-500 font-semibold">Complete!</span>
            </div>
            <Progress value={100} className="h-2 [&>div]:bg-green-600" />
          </div>

          {/* Completion Checklist Card */}
          <Card className="glass-strong shadow-xl">
            <CardHeader>
              <CardTitle>Setup Complete</CardTitle>
              <CardDescription>Everything is configured and ready to go</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Property Information */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">Property Information</h3>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    {completionData.propertyName} • {completionData.city}, {completionData.state}
                  </p>
                </div>
              </div>

              {/* Sites Added */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Tent className="h-4 w-4 text-green-600 dark:text-green-500" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">Sites Added</h3>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    {completionData.totalSites} sites ({completionData.siteBreakdown})
                  </p>
                </div>
              </div>

              {/* Pricing Configured */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-500" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">Pricing Configured</h3>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">All sites have nightly rates set</p>
                </div>
              </div>

              {/* Payment Processing */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-green-600 dark:text-green-500" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">Payment Processing</h3>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">Stripe connected and ready</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps Card */}
          <Card className="glass-strong shadow-xl">
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
              <CardDescription>Get started with your new campground booking system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Share Booking Page */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary-foreground">1</span>
                  </div>
                  <h3 className="font-semibold text-lg">Share Your Booking Page</h3>
                </div>
                <div className="ml-11 space-y-2">
                  <div className="flex gap-2">
                    <Input value={completionData.bookingPageUrl} readOnly className="font-mono text-sm bg-muted" />
                    <Button
                      onClick={handleCopyUrl}
                      variant="outline"
                      size="icon"
                      className="flex-shrink-0 bg-transparent"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied && (
                    <p className="text-sm text-green-600 dark:text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Copied to clipboard!
                    </p>
                  )}
                </div>
              </div>

              {/* Step 2: Test Booking */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary-foreground">2</span>
                  </div>
                  <h3 className="font-semibold text-lg">Create a Test Booking</h3>
                </div>
                <div className="ml-11 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Walk through the booking flow to see how your guests will experience it
                  </p>
                  <Button onClick={handleTestBooking} variant="outline" className="w-full sm:w-auto bg-transparent">
                    Try Test Booking
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Step 3: Dashboard */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary-foreground">3</span>
                  </div>
                  <h3 className="font-semibold text-lg">Explore Your Dashboard</h3>
                </div>
                <div className="ml-11 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Manage reservations, view payments, and track your property performance
                  </p>
                  <Button
                    onClick={() => router.push("/dashboard")}
                    className="w-full sm:w-auto bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70"
                  >
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Help & Resources */}
          <Card className="glass border-muted">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">Need help getting started?</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="outline" asChild>
                    <Link href="/docs">
                      <BookOpen className="mr-2 h-4 w-4" />
                      View Documentation
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="mailto:support@campos.com">
                      <Mail className="mr-2 h-4 w-4" />
                      Contact Support
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

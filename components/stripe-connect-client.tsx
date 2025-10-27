"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, CheckCircle2, Loader2, Tent } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"

export function StripeConnectClient() {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)

  const handleStripeConnect = async () => {
    setConnecting(true)

    try {
      // For demo purposes, simulate the Stripe Connect flow
      // In production, you would redirect to Stripe OAuth:
      // const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID
      // const redirectUri = `${window.location.origin}/api/stripe/connect/authorize`
      // const state = generateRandomState()
      // const stripeUrl = `https://connect.stripe.com/oauth/authorize?...`
      // sessionStorage.setItem('stripe_oauth_state', state)
      // window.location.href = stripeUrl

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Navigate to next step
      router.push("/onboarding/complete")
    } catch (error) {
      console.error("Error connecting to Stripe:", error)
      setConnecting(false)
    }
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
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Connect Payment Processing</h1>
            <p className="text-xl text-muted-foreground">One click to start accepting payments</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Step 3 of 4</span>
              <span className="text-muted-foreground">Payment Setup</span>
            </div>
            <Progress value={75} className="h-2" />
          </div>

          {/* Stripe Connect Card */}
          <Card className="glass-strong shadow-xl">
            <CardHeader>
              <CardTitle>Stripe Payment Processing</CardTitle>
              <CardDescription>Securely accept credit cards, debit cards, and digital wallets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                    <h3 className="font-semibold">No Hidden Fees</h3>
                    <p className="text-sm text-muted-foreground">Simple pricing: 2.9% + $0.30 per transaction</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Connect Button */}
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70"
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
            </CardContent>
          </Card>

          {/* Help Text */}
          <p className="text-sm text-center text-muted-foreground">
            Don't have a Stripe account?{" "}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Create one for free
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

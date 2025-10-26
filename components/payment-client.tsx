"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { Check, Tent, Lock, ArrowLeft, Shield, CreditCard } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { useCheckout } from "@/lib/booking/checkout-context"
import { PaymentForm } from "@/components/payment-form"
import type { SiteType } from "@/lib/booking/types"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const siteTypeColors: Record<SiteType, string> = {
  rv: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  tent: "bg-green-500/10 text-green-500 border-green-500/20",
  cabin: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  glamping: "bg-purple-500/10 text-purple-500 border-purple-500/20",
}

const steps = [
  { id: 1, name: "Site Selection", status: "complete" },
  { id: 2, name: "Guest Info", status: "complete" },
  { id: 3, name: "Payment", status: "current" },
  { id: 4, name: "Confirmation", status: "upcoming" },
]

export function PaymentClient() {
  const router = useRouter()
  const { checkoutData } = useCheckout()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Redirect if no checkout data
    if (!checkoutData.site || !checkoutData.guestInfo || !checkoutData.priceBreakdown) {
      console.log("[v0] Missing checkout data, redirecting to home")
      router.push("/book")
      return
    }

    // Create PaymentIntent
    const createPaymentIntent = async () => {
      try {
        const response = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: checkoutData.priceBreakdown!.total,
            reservationId: `temp-${Date.now()}`, // Temporary ID
          }),
        })

        const data = await response.json()
        setClientSecret(data.clientSecret)
      } catch (error) {
        console.error("[v0] Error creating payment intent:", error)
      } finally {
        setIsLoading(false)
      }
    }

    createPaymentIntent()
  }, [checkoutData, router])

  if (isLoading || !clientSecret) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparing secure checkout...</p>
        </div>
      </div>
    )
  }

  const appearance = {
    theme: "stripe" as const,
    variables: {
      colorPrimary: "#ef4444",
      colorBackground: "transparent",
      colorText: "currentColor",
      colorDanger: "#ef4444",
      fontFamily: "system-ui, sans-serif",
      spacingUnit: "4px",
      borderRadius: "8px",
    },
  }

  const options = {
    clientSecret,
    appearance,
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/book" className="flex items-center gap-2">
            <Tent className="h-6 w-6" />
            <span className="font-bold text-xl">CampOS</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="ghost">Sign In</Button>
          </div>
        </div>
      </nav>

      {/* Progress Indicator */}
      <div className="border-b bg-background/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                      step.status === "complete" && "bg-primary border-primary text-primary-foreground",
                      step.status === "current" && "bg-primary/10 border-primary text-primary",
                      step.status === "upcoming" && "bg-muted border-border text-muted-foreground",
                    )}
                  >
                    {step.status === "complete" ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{step.id}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs mt-2 font-medium hidden sm:block",
                      step.status === "current" && "text-foreground",
                      step.status !== "current" && "text-muted-foreground",
                    )}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2 transition-all",
                      step.status === "complete" ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-8 max-w-7xl mx-auto">
          {/* Left Column - Payment Form */}
          <div className="space-y-6">
            {/* Payment Method Card */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={options}>
                  <PaymentForm />
                </Elements>
              </CardContent>
            </Card>

            {/* Security Badges */}
            <Card className="glass">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-500" />
                    <span>SSL Encrypted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-green-500" />
                    <span>Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-green-500" />
                    <span>PCI Compliant</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Final Order Summary (Sticky) */}
          <div className="lg:sticky lg:top-24 h-fit">
            <Card className="glass-strong shadow-xl">
              <CardHeader>
                <CardTitle>Final Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Site Info */}
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={checkoutData.site?.image_url || "/placeholder.svg"}
                      alt={checkoutData.site?.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{checkoutData.site?.name}</h3>
                    <p className="text-sm text-muted-foreground">Site #{checkoutData.site?.site_number}</p>
                    <Badge className={cn("border mt-1", siteTypeColors[checkoutData.site?.site_type!])}>
                      {checkoutData.site?.site_type.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Guest Info */}
                <div>
                  <p className="text-sm font-medium mb-1">Guest</p>
                  <p className="text-sm text-muted-foreground">
                    {checkoutData.guestInfo?.first_name} {checkoutData.guestInfo?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{checkoutData.guestInfo?.email}</p>
                </div>

                <Separator />

                {/* Dates & Guests */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-in</span>
                    <span className="font-medium">
                      {checkoutData.checkInDate && format(new Date(checkoutData.checkInDate), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-out</span>
                    <span className="font-medium">
                      {checkoutData.checkOutDate && format(new Date(checkoutData.checkOutDate), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guests</span>
                    <span className="font-medium">{(checkoutData.numAdults || 0) + (checkoutData.numChildren || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nights</span>
                    <span className="font-medium">{checkoutData.priceBreakdown?.number_of_nights}</span>
                  </div>
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      ${checkoutData.priceBreakdown?.base_price_per_night} ×{" "}
                      {checkoutData.priceBreakdown?.number_of_nights}{" "}
                      {checkoutData.priceBreakdown?.number_of_nights === 1 ? "night" : "nights"}
                    </span>
                    <span className="font-medium">${checkoutData.priceBreakdown?.subtotal.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span>${checkoutData.priceBreakdown?.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-4">
                  <Button variant="outline" size="lg" className="w-full bg-transparent" asChild>
                    <Link href="/book/checkout">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Guest Info
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

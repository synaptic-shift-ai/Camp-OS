"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter, useParams } from "next/navigation"
import { format, differenceInDays } from "date-fns"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { ArrowLeft, Check, Lock, CreditCard, ChevronRight, TreePine, Shield, Loader2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCheckout } from "@/lib/booking/checkout-context"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_TAX_RATE } from "@/lib/booking/types"
import { CheckoutTimer } from "@/components/checkout-timer"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PaymentFormInner({ slug }: { slug: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const { checkoutData } = useCheckout()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    if (!termsAccepted) {
      setErrorMessage("Please accept the terms and conditions to continue")
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/book/${slug}/confirmation`,
      },
    })

    if (error) {
      console.error("Payment error:", error)
      setErrorMessage(error.message || "An unexpected error occurred.")
      setIsProcessing(false)
      toast({
        title: "Payment failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    }
  }

  if (!checkoutData.site || !checkoutData.checkInDate || !checkoutData.checkOutDate || !checkoutData.guestInfo) {
    return null
  }

  const numberOfNights = differenceInDays(checkoutData.checkOutDate, checkoutData.checkInDate)
  const priceBreakdown = checkoutData.priceBreakdown || {
    basePrice: checkoutData.site.base_price_per_night,
    nights: numberOfNights,
    subtotal: checkoutData.site.base_price_per_night * numberOfNights,
    cleaningFee: checkoutData.site.site_type === "cabin" ? 50 : 0,
    serviceFee: Math.round(checkoutData.site.base_price_per_night * numberOfNights * 0.1),
    taxRate: DEFAULT_TAX_RATE,
    taxes: 0,
    total: 0,
  }
  const taxableAmount = priceBreakdown.subtotal + (priceBreakdown.cleaningFee || 0) + (priceBreakdown.serviceFee || 0)
  priceBreakdown.taxes = Math.round(taxableAmount * DEFAULT_TAX_RATE)
  priceBreakdown.total =
    priceBreakdown.subtotal + (priceBreakdown.cleaningFee || 0) + (priceBreakdown.serviceFee || 0) + (priceBreakdown.taxes || 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PaymentElement />
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
        <h4 className="font-semibold text-sm text-gray-900">Billing Information</h4>
        <div className="text-sm text-gray-700">
          <p>
            {checkoutData.guestInfo.first_name} {checkoutData.guestInfo.last_name}
          </p>
          <p>{checkoutData.guestInfo.email}</p>
          {checkoutData.guestInfo.address && (
            <>
              <p>{checkoutData.guestInfo.address}</p>
              <p>
                {checkoutData.guestInfo.city}, {checkoutData.guestInfo.state} {checkoutData.guestInfo.zip_code}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Lock className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-gray-900 mb-1">Your payment is secure</p>
            <p>
              We use industry-standard encryption to protect your payment information. Your card details are never
              stored on our servers.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start space-x-3">
        <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked as boolean)} />
        <div className="space-y-1">
          <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
            I agree to the terms and conditions and cancellation policy <span className="text-red-500">*</span>
          </Label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/book/${slug}/guest-info`)}
          className="sm:w-auto"
          disabled={isProcessing}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Guest Info
        </Button>
        <Button
          type="submit"
          disabled={isProcessing || !stripe || !termsAccepted}
          className="flex-1 bg-[#2D5A27] hover:bg-[#1e3d1a] text-white h-12"
        >
          {isProcessing ? (
            <span className="flex items-center">
              <Loader2 className="animate-spin mr-2 h-5 w-5" />
              Processing Payment...
            </span>
          ) : (
            <>
              Complete Booking - ${((priceBreakdown.total || 0) / 100).toFixed(2)}
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-6 text-sm text-gray-600 pt-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-600" />
          <span>PCI Compliant</span>
        </div>
        <div className="hidden sm:block text-gray-300">•</div>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-green-600" />
          <span>256-bit Encryption</span>
        </div>
      </div>
    </form>
  )
}

export default function PaymentPage() {
  const params = useParams()
  const slug = params.slug as string
  const { checkoutData, setCheckoutData, isHydrated } = useCheckout()
  const router = useRouter()
  const { toast } = useToast()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Don't validate until hydration is complete
    if (!isHydrated) {
      console.log('[Payment] Waiting for hydration...')
      return
    }

    // Don't create payment intent if we already have one
    if (clientSecret) {
      console.log('[Payment] Already have client secret, skipping')
      return
    }

    console.log('[Payment] Checkout data:', {
      hasSite: !!checkoutData.site,
      hasCheckIn: !!checkoutData.checkInDate,
      hasCheckOut: !!checkoutData.checkOutDate,
      hasGuestInfo: !!checkoutData.guestInfo,
      hasReservationId: !!checkoutData.reservationId,
      hasPropertyId: !!checkoutData.propertyId,
      reservationId: checkoutData.reservationId,
      propertyId: checkoutData.propertyId,
    })

    if (
      !checkoutData.site ||
      !checkoutData.checkInDate ||
      !checkoutData.checkOutDate ||
      !checkoutData.guestInfo ||
      !checkoutData.reservationId ||
      !checkoutData.propertyId
    ) {
      console.error('[Payment] Missing required checkout data')
      toast({
        title: "Missing information",
        description: "Please complete the previous steps first.",
        variant: "destructive",
      })
      router.push(`/book/${slug}`)
      return
    }

    const createPaymentIntent = async () => {
      try {
        console.log('[Payment] Creating payment intent with:', {
          reservation_id: checkoutData.reservationId,
          property_id: checkoutData.propertyId,
        })

        const response = await fetch("/api/booking/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservation_id: checkoutData.reservationId,
            property_id: checkoutData.propertyId,
          }),
        })

        console.log('[Payment] Response status:', response.status)

        if (!response.ok) {
          const errorData = await response.json()
          console.error('[Payment] Error response:', errorData)
          throw new Error(errorData.error || `Failed to create payment intent: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('[Payment] Payment intent created successfully')
        setClientSecret(data.clientSecret)
        setCheckoutData({
          stripePaymentIntentId: data.paymentIntentId,
        })
      } catch (error) {
        console.error("[Payment] Error creating payment intent:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to prepare payment. Please try again.",
          variant: "destructive",
        })
        router.push(`/book/${slug}/guest-info`)
      } finally {
        setIsLoading(false)
      }
    }

    createPaymentIntent()
  }, [isHydrated, clientSecret, checkoutData.site, checkoutData.checkInDate, checkoutData.checkOutDate, checkoutData.guestInfo, checkoutData.reservationId, checkoutData.propertyId, router, slug])

  if (isLoading || !clientSecret) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 mx-auto mb-4 text-[#2D5A27]" />
          <p className="text-gray-600">Preparing secure checkout...</p>
        </div>
      </div>
    )
  }

  if (!checkoutData.site || !checkoutData.checkInDate || !checkoutData.checkOutDate || !checkoutData.guestInfo) {
    return null
  }

  const numberOfNights = differenceInDays(checkoutData.checkOutDate, checkoutData.checkInDate)
  const priceBreakdown = checkoutData.priceBreakdown || {
    basePrice: checkoutData.site.base_price_per_night,
    nights: numberOfNights,
    subtotal: checkoutData.site.base_price_per_night * numberOfNights,
    cleaningFee: checkoutData.site.site_type === "cabin" ? 50 : 0,
    serviceFee: Math.round(checkoutData.site.base_price_per_night * numberOfNights * 0.1),
    taxRate: DEFAULT_TAX_RATE,
    taxes: 0,
    total: 0,
  }
  const taxableAmount = priceBreakdown.subtotal + (priceBreakdown.cleaningFee || 0) + (priceBreakdown.serviceFee || 0)
  priceBreakdown.taxes = Math.round(taxableAmount * DEFAULT_TAX_RATE)
  priceBreakdown.total =
    priceBreakdown.subtotal + (priceBreakdown.cleaningFee || 0) + (priceBreakdown.serviceFee || 0) + (priceBreakdown.taxes || 0)

  const appearance = {
    theme: "stripe" as const,
    variables: {
      colorPrimary: "#2D5A27",
      colorBackground: "#ffffff",
      colorText: "#1f2937",
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#2D5A27] rounded-lg flex items-center justify-center">
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#2D5A27]">Pine Lake Campground</h1>
                <p className="text-xs text-gray-600">Secure Booking Portal</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => router.push("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center space-x-2 text-green-700">
              <Shield className="h-5 w-5" />
              <span className="font-medium">256-bit SSL Encryption</span>
            </div>
            <div className="flex items-center space-x-2 text-green-700">
              <Lock className="h-5 w-5" />
              <span className="font-medium">PCI Compliant</span>
            </div>
            <div className="flex items-center space-x-2 text-green-700">
              <Check className="h-5 w-5" />
              <span className="font-medium">Secure Payment Processing</span>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm max-w-2xl mx-auto">
            <div className="flex items-center space-x-2 text-gray-600">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">
                <Check className="h-4 w-4" />
              </div>
              <span className="font-medium">Select Dates & Site</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <div className="flex items-center space-x-2 text-gray-600">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">
                <Check className="h-4 w-4" />
              </div>
              <span className="font-medium">Guest Info</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <div className="flex items-center space-x-2 text-[#2D5A27] font-medium">
              <div className="w-6 h-6 bg-[#2D5A27] text-white rounded-full flex items-center justify-center text-xs">
                3
              </div>
              <span>Payment</span>
            </div>
          </div>
        </div>

        {checkoutData.reservedUntil && (
          <div className="max-w-4xl mx-auto">
            <CheckoutTimer
              reservedUntil={checkoutData.reservedUntil}
              propertySlug={slug}
            />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-[#2D5A27] flex items-center space-x-2">
                  <CreditCard className="h-6 w-6" />
                  <span>Payment Information</span>
                </CardTitle>
                <CardDescription>Complete your reservation with secure payment</CardDescription>
              </CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={options}>
                  <PaymentFormInner slug={slug} />
                </Elements>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="shadow-lg">
                <CardHeader className="bg-[#2D5A27] text-white">
                  <CardTitle>Booking Summary</CardTitle>
                  <CardDescription className="text-gray-200">Final charges</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {checkoutData.site.image_url && (
                    <div className="relative h-48 rounded-lg overflow-hidden">
                      <Image
                        src={checkoutData.site.image_url || "/placeholder.svg"}
                        alt={checkoutData.site.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{checkoutData.site.name}</h3>
                    <p className="text-sm text-gray-600 capitalize">{checkoutData.site.site_type} Site</p>
                  </div>

                  <div className="space-y-2 text-sm border-t pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Check-in:</span>
                      <span className="font-medium">{format(checkoutData.checkInDate, "MMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Check-out:</span>
                      <span className="font-medium">{format(checkoutData.checkOutDate, "MMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Nights:</span>
                      <span className="font-medium">{numberOfNights}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Guest:</span>
                      <span className="font-medium">
                        {checkoutData.guestInfo.first_name} {checkoutData.guestInfo.last_name}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        ${((priceBreakdown.basePrice || 0) / 100).toFixed(2)} × {priceBreakdown.nights} night
                        {priceBreakdown.nights !== 1 ? "s" : ""}
                      </span>
                      <span className="font-medium">${((priceBreakdown.subtotal || 0) / 100).toFixed(2)}</span>
                    </div>
                    {(priceBreakdown.cleaningFee || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Cleaning fee</span>
                        <span className="font-medium">${((priceBreakdown.cleaningFee || 0) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Service fee</span>
                      <span className="font-medium">${((priceBreakdown.serviceFee || 0) / 100).toFixed(2)}</span>
                    </div>
                    {(priceBreakdown.taxes || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Taxes ({(DEFAULT_TAX_RATE * 100).toFixed(1)}%)</span>
                        <span className="font-medium">${((priceBreakdown.taxes || 0) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total Due Today</span>
                      <span className="text-[#2D5A27]">${((priceBreakdown.total || 0) / 100).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-gray-700">
                    <p className="font-semibold mb-1">What's included:</p>
                    <ul className="space-y-1 text-xs">
                      <li className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Full campsite access</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>All listed amenities</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>24/7 customer support</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Free cancellation (7+ days)</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-4 space-y-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Instant booking confirmation</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Email receipt & details</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Secure payment guarantee</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

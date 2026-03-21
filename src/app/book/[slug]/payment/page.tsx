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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
  const [paymentElementReady, setPaymentElementReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Log Stripe/Elements availability when they change (payment element readiness debugging)
  useEffect(() => {
    console.log('[Payment] Stripe/Elements state:', {
      hasStripe: !!stripe,
      hasElements: !!elements,
      paymentElementReady,
    })
  }, [stripe, elements, paymentElementReady])

  // Log why "Complete Booking" button is disabled (for debugging)
  const submitDisabled = isProcessing || !stripe || !termsAccepted || !paymentElementReady
  useEffect(() => {
    if (!submitDisabled) return
    const reasons: string[] = []
    if (isProcessing) reasons.push('isProcessing')
    if (!stripe) reasons.push('stripe not ready')
    if (!termsAccepted) reasons.push('terms not accepted')
    if (!paymentElementReady) reasons.push('payment element not ready')
    console.log('[Payment] Complete Booking button disabled:', {
      reasons,
      isProcessing,
      hasStripe: !!stripe,
      termsAccepted,
      paymentElementReady,
    })
  }, [submitDisabled, isProcessing, stripe, termsAccepted, paymentElementReady])

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

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/book/${slug}/confirmation`,
        },
      })

      if (error) {
        console.error("Payment error:", error)
        setErrorMessage(error.message || "An unexpected error occurred.")
        toast({
          title: "Payment failed",
          description: error.message || "An unexpected error occurred.",
          variant: "destructive",
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred."
      console.error("Payment error:", err)
      setErrorMessage(message)
      toast({
        title: "Payment failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!checkoutData.site || !checkoutData.checkInDate || !checkoutData.checkOutDate || !checkoutData.guestInfo) {
    console.log('[Payment] PaymentFormInner returning null — missing checkout data:', {
      hasSite: !!checkoutData.site,
      hasCheckInDate: !!checkoutData.checkInDate,
      hasCheckOutDate: !!checkoutData.checkOutDate,
      hasGuestInfo: !!checkoutData.guestInfo,
    })
    return null
  }

  const numberOfNights = differenceInDays(checkoutData.checkOutDate, checkoutData.checkInDate)
  const raw = checkoutData.priceBreakdown
  const taxRate = raw?.tax_rate ?? raw?.taxRate ?? DEFAULT_TAX_RATE
  const fallback = {
    basePrice: checkoutData.site?.base_price_per_night ?? 0,
    base_price_per_night: checkoutData.site?.base_price_per_night ?? 0,
    nights: numberOfNights,
    number_of_nights: numberOfNights,
    subtotal: (checkoutData.site?.base_price_per_night ?? 0) * numberOfNights,
    cleaningFee: checkoutData.site?.site_type === "cabin" ? 5000 : 0,
    serviceFee: Math.round((checkoutData.site?.base_price_per_night ?? 0) * numberOfNights * 0.1),
    taxRate,
    taxes: 0,
    total: 0,
  }
  const priceBreakdown = { ...fallback, ...raw }
  const basePriceCents = priceBreakdown.basePrice ?? priceBreakdown.base_price_per_night ?? 0
  const nightsForDisplay = priceBreakdown.nights ?? priceBreakdown.number_of_nights ?? numberOfNights
  const discountCents = priceBreakdown.user_discounts?.reduce((sum, d) => sum + d.amount, 0) ?? 0
  const taxesCents =
    priceBreakdown.taxes ??
    Math.round((priceBreakdown.subtotal - discountCents) * taxRate)
  const totalCents =
    priceBreakdown.total ??
    priceBreakdown.subtotal -
    discountCents +
    taxesCents +
    (priceBreakdown.pet_fee ?? 0)

  console.log('[Payment] PaymentFormInner rendering form with PaymentElement (waiting for onReady)')

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PaymentElement
          onReady={() => {
            console.log('[Payment] PaymentElement onReady fired — element is mounted and ready')
            setPaymentElementReady(true)
          }}
          onLoadError={(event) => {
            console.error('[Payment] PaymentElement onLoadError:', event.error?.message ?? event)
          }}
        />
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
          disabled={submitDisabled}
          className="flex-1 bg-[#2D5A27] hover:bg-[#1e3d1a] text-white h-12"
        >
          {isProcessing ? (
            <span className="flex items-center">
              <Loader2 className="animate-spin mr-2 h-5 w-5" />
              Processing Payment...
            </span>
          ) : (
            <>
              Complete Booking - ${(totalCents / 100).toFixed(2)}
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
  const displayPropertyName =
    checkoutData.propertyName || slug.replace(/-[a-f0-9]{8}$/i, '').replace(/-/g, ' ')

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
  const raw = checkoutData.priceBreakdown
  const taxRate = raw?.tax_rate ?? raw?.taxRate ?? DEFAULT_TAX_RATE
  const fallback = {
    basePrice: checkoutData.site?.base_price_per_night ?? 0,
    base_price_per_night: checkoutData.site?.base_price_per_night ?? 0,
    nights: numberOfNights,
    number_of_nights: numberOfNights,
    subtotal: (checkoutData.site?.base_price_per_night ?? 0) * numberOfNights,
    cleaningFee: checkoutData.site?.site_type === "cabin" ? 5000 : 0,
    serviceFee: Math.round((checkoutData.site?.base_price_per_night ?? 0) * numberOfNights * 0.1),
    taxRate,
    taxes: 0,
    total: 0,
  }
  const priceBreakdown = { ...fallback, ...raw }
  const basePriceCents = priceBreakdown.basePrice ?? priceBreakdown.base_price_per_night ?? 0
  const nightsForDisplay = priceBreakdown.nights ?? priceBreakdown.number_of_nights ?? numberOfNights
  const discountCents = priceBreakdown.user_discounts?.reduce((sum, d) => sum + d.amount, 0) ?? 0
  const taxesCents =
    priceBreakdown.taxes ??
    Math.round((priceBreakdown.subtotal - discountCents) * taxRate)
  const totalCents =
    priceBreakdown.total ??
    priceBreakdown.subtotal -
    discountCents +
    taxesCents +
    (priceBreakdown.pet_fee ?? 0)

  const bookingSummaryMain = (
    <>
      {checkoutData.site.image_url && (
        <div className="relative h-48 overflow-hidden rounded-lg">
          <Image
            src={checkoutData.site.image_url || "/placeholder.svg"}
            alt={checkoutData.site.name}
            fill
            className="object-cover"
          />
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900">{checkoutData.site.name}</h3>
        <p className="text-sm capitalize text-gray-600">{checkoutData.site.site_type} Site</p>
      </div>

      <div className="space-y-2 border-t pt-4 text-sm">
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

      <div className="space-y-2 border-t pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {priceBreakdown.base_price_label ??
              `$${(basePriceCents / 100).toFixed(2)} × ${nightsForDisplay} night${nightsForDisplay !== 1 ? "s" : ""}`}
          </span>
          <span className="font-medium">${((priceBreakdown.subtotal ?? 0) / 100).toFixed(2)}</span>
        </div>
        {(priceBreakdown.cleaningFee ?? priceBreakdown.cleaning_fee ?? 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Cleaning fee</span>
            <span className="font-medium">
              ${((priceBreakdown.cleaningFee ?? priceBreakdown.cleaning_fee ?? 0) / 100).toFixed(2)}
            </span>
          </div>
        )}
        {discountCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Discount</span>
            <span className="font-medium text-green-700">-${(discountCents / 100).toFixed(2)}</span>
          </div>
        )}
        {(taxesCents ?? 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {priceBreakdown.tax_name || "Taxes"} (
              {((priceBreakdown.tax_rate ?? priceBreakdown.taxRate ?? DEFAULT_TAX_RATE) * 100).toFixed(1)}%)
            </span>
            <span className="font-medium">${((taxesCents ?? 0) / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-lg font-bold">
          <span>Total Due Today</span>
          <span className="text-[#2D5A27]">${(totalCents / 100).toFixed(2)}</span>
        </div>
      </div>

      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-gray-700">
        <p className="mb-1 font-semibold">What&apos;s included:</p>
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
    </>
  )

  const bookingSummaryFooter = (
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
  )

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
                <h1 className="text-xl font-bold text-[#2D5A27]">{displayPropertyName}</h1>
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
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 sm:mb-6">
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

        <div className="mb-3 sm:mb-4">
          <div className="-mx-1 flex justify-center overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex flex-nowrap items-center gap-0.5 text-[10px] font-medium sm:gap-1 sm:text-xs md:gap-1.5 md:text-sm">
              <div className="flex shrink-0 items-center gap-1 text-gray-600">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <Check className="h-3 w-3" aria-hidden />
                </div>
                <span className="whitespace-nowrap leading-none">Select Dates & Site</span>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
              <div className="flex shrink-0 items-center gap-1 text-gray-600">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <Check className="h-3 w-3" aria-hidden />
                </div>
                <span className="whitespace-nowrap leading-none">Guest Info</span>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
              <div className="flex shrink-0 items-center gap-1 text-[#2D5A27]">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2D5A27] text-[10px] font-semibold tabular-nums leading-none text-white">
                  3
                </div>
                <span className="whitespace-nowrap leading-none">Payment</span>
              </div>
            </div>
          </div>
        </div>

        {checkoutData.reservedUntil && (
          <div className="max-w-4xl mx-auto">
            <CheckoutTimer
              reservedUntil={checkoutData.reservedUntil}
              propertySlug={slug}
              reservationId={checkoutData.reservationId}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Mobile: summary first (order-1); desktop: payment left (order-1) */}
          <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-2xl text-[#2D5A27]">
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

          <div className="order-1 lg:order-2 lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              {/* Mobile: collapsible summary above payment */}
              <div className="mb-2 lg:hidden">
                <Accordion
                  type="single"
                  collapsible
                  className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-lg"
                >
                  <AccordionItem value="booking-summary" className="border-0">
                    <AccordionTrigger className="rounded-t-lg bg-[#2D5A27] px-4 py-3 text-left text-base font-semibold text-white hover:no-underline data-[state=open]:rounded-b-none [&>svg]:text-white">
                      <span className="flex flex-col items-start gap-0.5">
                        <span>Booking Summary</span>
                        <span className="text-xs font-normal text-white/80">
                          Final charges
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-0">
                      <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                        {bookingSummaryMain}
                        {bookingSummaryFooter}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Desktop: full card in sidebar */}
              <div className="hidden lg:block">
                <Card className="shadow-lg">
                  <CardHeader className="bg-[#2D5A27] text-white">
                    <CardTitle>Booking Summary</CardTitle>
                    <CardDescription className="text-gray-200">Final charges</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">{bookingSummaryMain}</CardContent>
                </Card>
                {bookingSummaryFooter}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

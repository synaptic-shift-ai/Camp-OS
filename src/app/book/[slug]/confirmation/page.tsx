"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { format, differenceInDays } from "date-fns"
import { Check, Download, Mail, Calendar, MapPin, Phone, Printer, Sparkles } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCheckout } from "@/lib/booking/checkout-context"
import { downloadConfirmationPdf } from "@/lib/booking/confirmation-pdf"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_TAX_RATE } from "@/lib/booking/types"
import { BookingPortalHeader } from "@/components/guest/booking-portal-header"
import { cn, capitalizeWordsPreserveSpacing } from "@/lib/utils"

// API response types
type ConfirmPaymentResponse =
  | {
    success: true
    data: {
      reservation_id: string
      confirmation_number: string
      status: string
      payment_status: string
      guest_name: string
      guest_email: string
      property_name: string
      site_name: string
      check_in_date: string
      check_out_date: string
      total_amount_cents: number
      paid_amount_cents: number
      email_sent: boolean
    }
    message: string
  }
  | {
    success: false
    error: {
      code: string
      message: string
      details?: unknown
    }
  }

function isPaymentAlreadyFinalized(result: ConfirmPaymentResponse): boolean {
  return (
    !result.success &&
    result.error.code === "RESERVATION_NOT_PENDING" &&
    result.error.message.toLowerCase().includes("confirmed")
  )
}

export default function ConfirmationPage() {
  const params = useParams()
  const slug = params.slug as string
  const searchParams = useSearchParams()
  const { checkoutData, clearCheckoutData, isHydrated } = useCheckout()
  const router = useRouter()
  const { toast } = useToast()
  const isStartingNewBookingRef = useRef(false)
  const [showConfetti, setShowConfetti] = useState(true)
  const [showCheckmark, setShowCheckmark] = useState(false)
  const [_isConfirming, setIsConfirming] = useState(false)
  const [hasAttemptedConfirmation, setHasAttemptedConfirmation] = useState(false)
  const [_confirmationError, setConfirmationError] = useState<string | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [serverPaidAmountCents, setServerPaidAmountCents] = useState<number | null>(null)
  const [serverReservationTotalCents, setServerReservationTotalCents] = useState<number | null>(null)

  // Helper to format cents as dollars
  const formatCurrency = (cents: number) => {
    return (cents / 100).toFixed(2)
  }

  // Handle payment confirmation when redirected from Stripe
  useEffect(() => {
    const paymentIntent = searchParams.get("payment_intent")

    // Only confirm if we have a payment intent and haven't attempted confirmation yet
    if (paymentIntent && checkoutData.reservationId && !hasAttemptedConfirmation && checkoutData.confirmationNumber) {
      setIsConfirming(true)
      setHasAttemptedConfirmation(true) // Prevent infinite loop

      fetch("/api/guest/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_intent_id: paymentIntent,
          reservation_id: checkoutData.reservationId,
        }),
      })
        .then((response) => response.json())
        .then((result: ConfirmPaymentResponse) => {
          if (result.success || isPaymentAlreadyFinalized(result)) {
            if (!result.success) {
              console.log("[Confirmation] Payment already finalized (idempotent)")
            } else {
              console.log("[Confirmation] Payment confirmed successfully")
              setServerPaidAmountCents(result.data.paid_amount_cents)
              setServerReservationTotalCents(result.data.total_amount_cents)
            }
            router.replace(`/book/${slug}/confirmation`)
          } else {
            console.error("[Confirmation] Payment confirmation failed:", result.error)
            setConfirmationError(result.error.message || "Failed to confirm payment")
            toast({
              title: "Payment confirmation issue",
              description: result.error.message || "There was an issue confirming your payment.",
              variant: "destructive",
            })
          }
        })
        .catch((error) => {
          console.error("[Confirmation] Error confirming payment:", error)
          setConfirmationError("An error occurred while confirming your payment")
          toast({
            title: "Error",
            description: "Failed to confirm payment. Please contact support.",
            variant: "destructive",
          })
        })
        .finally(() => {
          setIsConfirming(false)
        })
    }
  }, [searchParams, checkoutData.reservationId, checkoutData.confirmationNumber, toast, hasAttemptedConfirmation, router, slug])

  // Fetch server-side total_amount when page loads without going through
  // the confirm flow (e.g., returning to an already-confirmed booking).
  useEffect(() => {
    if (!checkoutData.reservationId || serverPaidAmountCents !== null) return

    fetch(`/api/guest/reservation-total?reservation_id=${checkoutData.reservationId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.paid_amount_cents != null) {
          setServerPaidAmountCents(data.paid_amount_cents)
        }
        if (data?.total_amount_cents != null) {
          setServerReservationTotalCents(data.total_amount_cents)
        }
      })
      .catch(() => {
        // Non-critical — will fall back to checkout price breakdown
      })
  }, [checkoutData.reservationId, serverPaidAmountCents])

  useEffect(() => {
    // Wait for sessionStorage to hydrate before checking
    if (!isHydrated) return
    if (isStartingNewBookingRef.current) return

    if (!checkoutData.confirmationNumber) {
      toast({
        title: "No confirmation found",
        description: "Please complete the booking process first.",
        variant: "destructive",
      })
      router.push(`/book/${slug}`)
    }
  }, [checkoutData, router, toast, slug, isHydrated])

  useEffect(() => {
    // Trigger checkmark animation after a brief delay
    const checkmarkTimer = setTimeout(() => setShowCheckmark(true), 300)
    // Hide confetti after 5 seconds
    const confettiTimer = setTimeout(() => setShowConfetti(false), 5000)

    return () => {
      clearTimeout(checkmarkTimer)
      clearTimeout(confettiTimer)
    }
  }, [])

  // Redirect to booking portal on browser back button
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    const handlePopState = () => {
      // Synchronously re-push to prevent the browser from completing the back navigation
      window.history.pushState(null, '', window.location.href)
      // Then navigate to the booking portal
      router.replace(`/book/${slug}`)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [router, slug])

  if (!checkoutData.confirmationNumber || !checkoutData.site || !checkoutData.guestInfo) {
    return null
  }

  const displayPropertyName =
    checkoutData.propertyName || capitalizeWordsPreserveSpacing(slug.replace(/-[a-f0-9]{8}$/i, '').replace(/-/g, ' '))

  const numberOfNights = checkoutData.priceBreakdown?.number_of_nights
    ?? differenceInDays(checkoutData.checkOutDate!, checkoutData.checkInDate!)

  const rawPriceBreakdown = checkoutData.priceBreakdown
  const taxRate =
    rawPriceBreakdown?.tax_rate ??
    rawPriceBreakdown?.taxRate ??
    DEFAULT_TAX_RATE

  // Normalize price breakdown so it matches what we show in the booking summary.
  const priceBreakdown =
    rawPriceBreakdown
      ? {
        basePrice: rawPriceBreakdown.base_price_per_night ?? 0,
        nights: rawPriceBreakdown.number_of_nights ?? numberOfNights,
        subtotal: rawPriceBreakdown.subtotal ?? 0,
        serviceFee: rawPriceBreakdown.serviceFee ?? rawPriceBreakdown.service_fee ?? 0,
        pet_fee: rawPriceBreakdown.pet_fee ?? 0,
        taxRate,
        taxes: rawPriceBreakdown.taxes ?? 0,
        total: rawPriceBreakdown.total ?? 0,
        tax_name: rawPriceBreakdown.tax_name,
        user_discounts: rawPriceBreakdown.user_discounts,
      }
      : {
        basePrice: checkoutData.site.base_price_per_night,
        nights: numberOfNights,
        subtotal: checkoutData.site.base_price_per_night * numberOfNights,
        serviceFee: Math.round(checkoutData.site.base_price_per_night * numberOfNights * 0.1),
        pet_fee: 0,
        taxRate,
        taxes: 0,
        total: 0,
        user_discounts: [],
      }

  const discountCents =
    priceBreakdown.user_discounts?.reduce((sum, d) => sum + d.amount, 0) ?? 0
  const userFeeItems = rawPriceBreakdown?.user_fees ?? []
  const nonPetUserFeeItems = userFeeItems.filter((fee) => fee.id !== "legacy-pet")
  const userPetFeeCents = userFeeItems
    .filter((fee) => fee.id === "legacy-pet")
    .reduce((sum, fee) => sum + fee.amount, 0)
  const totalPetFeeCents = (priceBreakdown.pet_fee ?? 0) + userPetFeeCents
  const petCount = checkoutData.numPets || 0

  const basePriceLineLabel =
    rawPriceBreakdown?.base_price_label ??
    `$${formatCurrency(priceBreakdown.basePrice || 0)} × ${priceBreakdown.nights} night${priceBreakdown.nights !== 1 ? "s" : ""}`

  // Only recompute taxes/total when we didn't get a full breakdown from the API.
  if (!rawPriceBreakdown) {
    const taxableAmount = priceBreakdown.subtotal - discountCents
    priceBreakdown.taxes = Math.round(taxableAmount * taxRate)
    priceBreakdown.total =
      priceBreakdown.subtotal -
      discountCents +
      (priceBreakdown.serviceFee || 0) +
      (priceBreakdown.taxes || 0) +
      totalPetFeeCents
  }

  const reservationTotalCents = serverReservationTotalCents ?? priceBreakdown.total
  const depositAmountCents = rawPriceBreakdown?.deposit_amount ?? 0
  const isDepositPayment =
    checkoutData.paymentOption === "deposit" ||
    (serverPaidAmountCents != null &&
      serverReservationTotalCents != null &&
      serverPaidAmountCents > 0 &&
      serverPaidAmountCents < serverReservationTotalCents)
  const totalPaidCents =
    serverPaidAmountCents ??
    (isDepositPayment && depositAmountCents > 0
      ? depositAmountCents
      : reservationTotalCents)
  const remainingBalanceCents = Math.max(0, reservationTotalCents - totalPaidCents)

  function handleDownloadPdf() {
    setIsDownloadingPdf(true)
    try {
      const basePriceCents = priceBreakdown.basePrice
      const taxRate = priceBreakdown.taxRate ?? DEFAULT_TAX_RATE
      const taxLabel =
        priceBreakdown.tax_name ??
        `Taxes (${(taxRate * 100).toFixed(1)}%)`
      const petFee = totalPetFeeCents
      const taxes = priceBreakdown.taxes ?? 0

      downloadConfirmationPdf({
        confirmationNumber: checkoutData.confirmationNumber!,
        site: {
          name: checkoutData.site!.name,
          site_type: checkoutData.site!.site_type,
        },
        checkInDate: checkoutData.checkInDate!,
        checkOutDate: checkoutData.checkOutDate!,
        guest: {
          first_name: checkoutData.guestInfo!.first_name,
          last_name: checkoutData.guestInfo!.last_name,
          email: checkoutData.guestInfo!.email,
          phone: checkoutData.guestInfo!.phone,
        },
        nights: priceBreakdown.nights ?? numberOfNights,
        basePriceCents,
        basePriceLineLabel,
        subtotalCents: priceBreakdown.subtotal,
        serviceFeeCents: priceBreakdown.serviceFee ?? 0,
        ...(petFee > 0 && { petFeeCents: petFee }),
        ...(discountCents > 0 && { discountCents }),
        ...(taxes > 0 && { taxesCents: taxes, taxLabel }),
        totalCents: totalPaidCents,
        propertyName: displayPropertyName,
        ...(checkoutData.propertyAddress ? { propertyAddress: checkoutData.propertyAddress } : {}),
      })

      const filename = `${checkoutData.confirmationNumber!.toUpperCase()}.pdf`
      toast({
        title: "PDF downloaded",
        description: `Saved as ${filename}`,
        variant: "success",
      })
    } catch (err) {
      console.error("[Confirmation] PDF download failed:", err)
      toast({
        title: "Download failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleNewBooking = () => {
    isStartingNewBookingRef.current = true
    clearCheckoutData()
    router.push(`/book/${slug}`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 print:hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: "-10px",
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: ["#2D5A27", "#8FBC8F", "#FFD700", "#FF6B6B", "#4ECDC4"][
                    Math.floor(Math.random() * 5)
                  ],
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      <BookingPortalHeader
        propertyName={displayPropertyName}
        subtitle="Booking Confirmed"
        backHref={`/book/${slug}`}
      />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div
              className={`mb-4 inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#2D5A27] to-[#1e3d1a] shadow-lg transition-all duration-700 dark:from-emerald-800 dark:to-emerald-950 ${showCheckmark ? "scale-100 opacity-100" : "scale-0 opacity-0"
                }`}
            >
              <Check className="h-12 w-12 text-white animate-bounce" />
            </div>
            <div className="mb-2 flex items-center justify-center gap-2">
              <Sparkles className="h-6 w-6 animate-pulse text-amber-500 dark:text-amber-400" />
              <h1 className="animate-fade-in text-4xl font-bold text-foreground">Booking Confirmed!</h1>
              <Sparkles className="h-6 w-6 animate-pulse text-amber-500 dark:text-amber-400" />
            </div>
            <p className="text-lg text-muted-foreground animate-fade-in-delay">
              Your adventure awaits! We've sent a confirmation email to{" "}
              <span className={cn("font-medium", "text-[#2D5A27] dark:text-emerald-400")}>{checkoutData.guestInfo.email}</span>
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#2D5A27]/15 bg-[#e7f2e6] px-4 py-2 text-sm font-medium text-[#2D5A27] animate-fade-in-delay-2 dark:border-emerald-700/40 dark:bg-emerald-950/50 dark:text-emerald-100">
              <Check className="h-4 w-4" />
              Payment processed successfully
            </div>
          </div>

          <Card className="shadow-xl mb-6 animate-slide-up border-2 border-border bg-card">
            <CardHeader className="bg-gradient-to-r from-[#2D5A27] to-[#1e3d1a] text-white dark:from-emerald-950 dark:to-emerald-900">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl text-white">Confirmation Details</CardTitle>
                  <CardDescription className="text-white/80">Save this for your records</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/80">Confirmation Number</p>
                  <p className="text-2xl font-bold text-white">{checkoutData.confirmationNumber}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6 bg-card">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  {checkoutData.site.image_url && (
                    <div className="relative h-48 rounded-lg overflow-hidden mb-4">
                      <Image
                        src={checkoutData.site.image_url || "/placeholder.svg"}
                        alt={checkoutData.site.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <h3 className="font-semibold text-xl text-foreground mb-1">{checkoutData.site.name}</h3>
                  <p className="text-muted-foreground capitalize mb-4">{checkoutData.site.site_type} Site</p>

                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <Calendar className={cn("mt-0.5 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                      <div>
                        <p className="font-medium text-foreground">Check-in</p>
                        <p className="text-muted-foreground">{format(checkoutData.checkInDate!, "EEEE, MMMM dd, yyyy")}</p>
                        <p className="text-sm text-muted-foreground">After 2:00 PM</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Calendar className={cn("mt-0.5 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                      <div>
                        <p className="font-medium text-foreground">Check-out</p>
                        <p className="text-muted-foreground">{format(checkoutData.checkOutDate!, "EEEE, MMMM dd, yyyy")}</p>
                        <p className="text-sm text-muted-foreground">Before 11:00 AM</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MapPin className={cn("mt-0.5 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                      <div>
                        <p className="font-medium text-foreground">Location</p>
                        <p className="text-muted-foreground">{displayPropertyName}</p>
                        <p className="text-sm text-muted-foreground">{checkoutData.propertyAddress}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-lg text-foreground mb-4">Guest Information</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium text-foreground">
                        {checkoutData.guestInfo.first_name} {checkoutData.guestInfo.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium text-foreground">{checkoutData.guestInfo.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium text-foreground">{checkoutData.guestInfo.phone}</p>
                    </div>
                    {checkoutData.numVehicles != null && (
                      <div>
                        <p className="text-muted-foreground">Vehicles</p>
                        <p className="font-medium text-foreground">{checkoutData.numVehicles}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-border">
                    <h4 className="font-semibold text-lg text-foreground mb-3">Payment Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground text-left min-w-0 shrink">
                          {basePriceLineLabel}
                        </span>
                        <span className="font-medium text-foreground shrink-0">${formatCurrency(priceBreakdown.subtotal)}</span>
                      </div>
                      {nonPetUserFeeItems.map((fee) => (
                        <div key={fee.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{fee.title}</span>
                          <span className="font-medium text-foreground">${(fee.amount / 100).toFixed(2)}</span>
                        </div>
                      ))}
                      {totalPetFeeCents > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Additional charge for pets
                            {petCount > 0 && (
                              <> ({petCount} {petCount === 1 ? "pet" : "pets"})</>
                            )}
                          </span>
                          <span className="font-medium text-foreground">${(totalPetFeeCents / 100).toFixed(2)}</span>
                        </div>
                      )}
                      {discountCents > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Discount</span>
                          <span className={cn("font-medium", "text-[#2D5A27] dark:text-emerald-400")}>-${formatCurrency(discountCents)}</span>
                        </div>
                      )}
                      {(priceBreakdown.taxes || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {(priceBreakdown.tax_name || "Taxes")} (
                            {(priceBreakdown.taxRate * 100).toFixed(1)}%)
                          </span>
                          <span className="font-medium text-foreground">${formatCurrency(priceBreakdown.taxes!)}</span>
                        </div>
                      )}
                      {isDepositPayment && remainingBalanceCents > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reservation Total</span>
                          <span className="font-medium text-foreground">${formatCurrency(reservationTotalCents)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
                        <span className="text-foreground">
                          {isDepositPayment && remainingBalanceCents > 0 ? "Deposit Paid" : "Total Paid"}
                        </span>
                        <span className="text-[#2D5A27] dark:text-emerald-400">${formatCurrency(totalPaidCents)}</span>
                      </div>
                      {isDepositPayment && remainingBalanceCents > 0 && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Remaining Balance</span>
                          <span>${formatCurrency(remainingBalanceCents)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4 mb-8 print:hidden">
            <Button
              variant="outline"
              className="h-12 border-border bg-background text-foreground transition-all duration-300 hover:scale-105 hover:border-[#2D5A27] hover:bg-muted dark:hover:border-emerald-500"
            >
              <Mail className="mr-2 h-4 w-4" />
              Email Confirmation
            </Button>
            <Button
              variant="outline"
              className="h-12 border-border bg-background text-foreground transition-all duration-300 hover:scale-105 hover:border-[#2D5A27] hover:bg-muted dark:hover:border-emerald-500"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloadingPdf ? "Downloading…" : "Download PDF"}
            </Button>
            <Button
              variant="outline"
              className="h-12 border-border bg-background text-foreground transition-all duration-300 hover:scale-105 hover:border-[#2D5A27] hover:bg-muted dark:hover:border-emerald-500"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>

          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-2 text-lg", "text-[#2D5A27] dark:text-emerald-400")}>
                <Sparkles className="h-5 w-5" />
                What's Next?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3">
                <Check className={cn("mt-0.5 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                <div>
                  <p className="font-medium text-foreground">Check your email</p>
                  <p className="text-sm text-muted-foreground">
                    We've sent detailed directions and check-in instructions to your email
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className={cn("mt-0.5 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                <div>
                  <p className="font-medium text-foreground">Prepare for your trip</p>
                  <p className="text-sm text-muted-foreground">Review our packing list and campground rules</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Phone className={cn("mt-0.5 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                <div>
                  <p className="font-medium text-foreground">Questions?</p>
                  <p className="text-sm text-muted-foreground">
                    Call us at (555) 123-4567 or email support@pinelakecampground.com
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center mt-8 print:hidden">
            <Button
              onClick={handleNewBooking}
              className={cn(
                "h-12 px-8 text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl",
                "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900",
              )}
            >
              Make Another Booking
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-confetti {
          animation: confetti linear forwards;
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in 0.6s ease-out 0.2s both;
        }
        
        .animate-fade-in-delay-2 {
          animation: fade-in 0.6s ease-out 0.4s both;
        }
        
        .animate-slide-up {
          animation: slide-up 0.6s ease-out 0.3s both;
        }
      `}</style>
    </div>
  )
}

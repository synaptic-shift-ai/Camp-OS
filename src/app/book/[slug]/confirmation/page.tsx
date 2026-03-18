"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { format, differenceInDays } from "date-fns"
import { Check, Download, Mail, Calendar, MapPin, Phone, TreePine, Printer, Sparkles } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCheckout } from "@/lib/booking/checkout-context"
import { downloadConfirmationPdf } from "@/lib/booking/confirmation-pdf"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_TAX_RATE } from "@/lib/booking/types"

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

export default function ConfirmationPage() {
  const params = useParams()
  const slug = params.slug as string
  const searchParams = useSearchParams()
  const { checkoutData, clearCheckoutData, isHydrated } = useCheckout()
  const router = useRouter()
  const { toast } = useToast()
  const [showConfetti, setShowConfetti] = useState(true)
  const [showCheckmark, setShowCheckmark] = useState(false)
  const [_isConfirming, setIsConfirming] = useState(false)
  const [hasAttemptedConfirmation, setHasAttemptedConfirmation] = useState(false)
  const [_confirmationError, setConfirmationError] = useState<string | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

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
          if (!result.success) {
            console.error("[Confirmation] Payment confirmation failed:", result.error)
            setConfirmationError(result.error.message || "Failed to confirm payment")
            toast({
              title: "Payment confirmation issue",
              description: result.error.message || "There was an issue confirming your payment.",
              variant: "destructive",
            })
          } else {
            console.log("[Confirmation] Payment confirmed successfully")
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
  }, [searchParams, checkoutData.reservationId, checkoutData.confirmationNumber, toast, hasAttemptedConfirmation])

  useEffect(() => {
    // Wait for sessionStorage to hydrate before checking
    if (!isHydrated) return

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

  if (!checkoutData.confirmationNumber || !checkoutData.site || !checkoutData.guestInfo) {
    return null
  }

  const displayPropertyName =
    checkoutData.propertyName || slug.replace(/-[a-f0-9]{8}$/i, '').replace(/-/g, ' ')

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
        cleaningFee: rawPriceBreakdown.cleaningFee ?? rawPriceBreakdown.cleaning_fee ?? 0,
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
        cleaningFee: checkoutData.site.site_type === "cabin" ? 5000 : 0,
        serviceFee: Math.round(checkoutData.site.base_price_per_night * numberOfNights * 0.1),
        pet_fee: 0,
        taxRate,
        taxes: 0,
        total: 0,
        user_discounts: [],
      }

  const discountCents =
    priceBreakdown.user_discounts?.reduce((sum, d) => sum + d.amount, 0) ?? 0

  // Only recompute taxes/total when we didn't get a full breakdown from the API.
  if (!rawPriceBreakdown) {
    const taxableAmount = priceBreakdown.subtotal - discountCents
    priceBreakdown.taxes = Math.round(taxableAmount * taxRate)
    priceBreakdown.total =
      priceBreakdown.subtotal - discountCents + (priceBreakdown.taxes || 0) + (priceBreakdown.pet_fee || 0)
  }

  function handleDownloadPdf() {
    setIsDownloadingPdf(true)
    try {
      const basePriceCents = priceBreakdown.basePrice
      const taxRate = priceBreakdown.taxRate ?? DEFAULT_TAX_RATE
      const taxLabel =
        priceBreakdown.tax_name ??
        `Taxes (${(taxRate * 100).toFixed(1)}%)`
      const cleaningFee = priceBreakdown.cleaningFee ?? 0
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
        subtotalCents: priceBreakdown.subtotal,
        ...(cleaningFee > 0 && { cleaningFeeCents: cleaningFee }),
        serviceFeeCents: priceBreakdown.serviceFee ?? 0,
        ...(discountCents > 0 && { discountCents }),
        ...(taxes > 0 && { taxesCents: taxes, taxLabel }),
        totalCents: priceBreakdown.total,
      })

      const filename = `${checkoutData.confirmationNumber!.toUpperCase()}.pdf`
      toast({
        title: "PDF downloaded",
        description: `Saved as ${filename}`,
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

      <header className="bg-background border-b border-border sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-700 rounded-lg flex items-center justify-center">
                <TreePine className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{displayPropertyName}</h1>
                <p className="text-xs text-muted-foreground">Booking Confirmed</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => router.push("/")} className="text-foreground hover:bg-muted">
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div
              className={`inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full mb-4 shadow-lg transition-all duration-700 ${showCheckmark ? "scale-100 opacity-100" : "scale-0 opacity-0"
                }`}
            >
              <Check className="h-12 w-12 text-white animate-bounce" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
              <h1 className="text-4xl font-bold text-foreground animate-fade-in">Booking Confirmed!</h1>
              <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
            </div>
            <p className="text-lg text-muted-foreground animate-fade-in-delay">
              Your adventure awaits! We've sent a confirmation email to{" "}
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{checkoutData.guestInfo.email}</span>
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 rounded-full text-sm font-medium animate-fade-in-delay-2">
              <Check className="h-4 w-4" />
              Payment processed successfully
            </div>
          </div>

          <Card className="shadow-xl mb-6 animate-slide-up border-2 border-border bg-card">
            <CardHeader className="bg-gradient-to-r from-emerald-700 to-emerald-900 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Confirmation Details</CardTitle>
                  <CardDescription className="text-primary-foreground/80">Save this for your records</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-primary-foreground/80">Confirmation Number</p>
                  <p className="text-2xl font-bold">{checkoutData.confirmationNumber}</p>
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
                      <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Check-in</p>
                        <p className="text-muted-foreground">{format(checkoutData.checkInDate!, "EEEE, MMMM dd, yyyy")}</p>
                        <p className="text-sm text-muted-foreground">After 2:00 PM</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Check-out</p>
                        <p className="text-muted-foreground">{format(checkoutData.checkOutDate!, "EEEE, MMMM dd, yyyy")}</p>
                        <p className="text-sm text-muted-foreground">Before 11:00 AM</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Location</p>
                        <p className="text-muted-foreground">{displayPropertyName}</p>
                        <p className="text-sm text-muted-foreground">123 Forest Road, Pine Valley, CA 95000</p>
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
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          ${formatCurrency(priceBreakdown.basePrice || 0)} × {priceBreakdown.nights} night
                          {priceBreakdown.nights !== 1 ? "s" : ""}
                        </span>
                        <span className="font-medium text-foreground">${formatCurrency(priceBreakdown.subtotal)}</span>
                      </div>
                      {(priceBreakdown.cleaningFee || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cleaning fee</span>
                          <span className="font-medium text-foreground">${formatCurrency(priceBreakdown.cleaningFee!)}</span>
                        </div>
                      )}
                      {discountCents > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Discount</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">-${formatCurrency(discountCents)}</span>
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
                      <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
                        <span className="text-foreground">Total Paid</span>
                        <span className="text-emerald-600 dark:text-emerald-400">${formatCurrency(priceBreakdown.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4 mb-8 print:hidden">
            <Button
              variant="outline"
              className="h-12 bg-background border-border text-foreground hover:bg-muted hover:border-emerald-500 transition-all duration-300 hover:scale-105"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email Confirmation
            </Button>
            <Button
              variant="outline"
              className="h-12 bg-background border-border text-foreground hover:bg-muted hover:border-emerald-500 transition-all duration-300 hover:scale-105"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloadingPdf ? "Downloading…" : "Download PDF"}
            </Button>
            <Button
              variant="outline"
              className="h-12 bg-background border-border text-foreground hover:bg-muted hover:border-emerald-500 transition-all duration-300 hover:scale-105"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>

          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                What's Next?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Check your email</p>
                  <p className="text-sm text-muted-foreground">
                    We've sent detailed directions and check-in instructions to your email
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Prepare for your trip</p>
                  <p className="text-sm text-muted-foreground">Review our packing list and campground rules</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
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
              className="bg-emerald-700 hover:bg-emerald-800 text-primary-foreground h-12 px-8 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
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

"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { useCheckout } from "@/lib/booking/checkout-context"

export function PaymentForm() {
  const stripe = useStripe()
  const elements = useElements()
  const _router = useRouter()
  const { checkoutData } = useCheckout()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

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

    console.log("[v0] Processing payment...")

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/book/confirmation`,
      },
    })

    if (error) {
      console.error("[v0] Payment error:", error)
      setErrorMessage(error.message || "An unexpected error occurred.")
      setIsProcessing(false)
    } else {
      console.log("[v0] Payment successful!")
      // Payment will redirect to confirmation page
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stripe Payment Element */}
      <div className="space-y-4">
        <PaymentElement />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Terms and Conditions */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
        <Checkbox
          id="terms"
          checked={termsAccepted}
          onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
        />
        <div className="space-y-1">
          <Label htmlFor="terms" className="cursor-pointer font-normal text-sm">
            I agree to the{" "}
            <a href="#" className="text-primary hover:underline">
              Terms and Conditions
            </a>{" "}
            and{" "}
            <a href="#" className="text-primary hover:underline">
              Cancellation Policy
            </a>
          </Label>
          <p className="text-xs text-muted-foreground">
            By completing this booking, you agree to our terms of service and cancellation policy.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70"
        disabled={!stripe || isProcessing || !termsAccepted}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>Complete Booking - ${((checkoutData.priceBreakdown?.total || 0) / 100).toFixed(2)}</>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Your payment information is encrypted and secure. We never store your card details.
      </p>
    </form>
  )
}

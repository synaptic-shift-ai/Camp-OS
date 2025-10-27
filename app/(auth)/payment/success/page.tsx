import { Suspense } from "react"
import { PaymentSuccessClient } from "@/components/payment-success-client"

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PaymentSuccessClient />
    </Suspense>
  )
}

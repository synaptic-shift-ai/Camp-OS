import { Suspense } from "react"
import { PaymentFailureClient } from "@/components/payment-failure-client"

export default function PaymentFailurePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PaymentFailureClient />
    </Suspense>
  )
}

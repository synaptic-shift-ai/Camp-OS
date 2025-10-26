import { Suspense } from "react"
import { PaymentClient } from "@/components/payment-client"

export default function PaymentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentClient />
    </Suspense>
  )
}

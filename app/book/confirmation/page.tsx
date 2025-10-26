import { Suspense } from "react"
import { ConfirmationClient } from "@/components/confirmation-client"

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmationClient />
    </Suspense>
  )
}

import { Suspense } from "react"
import { ChoosePlanClient } from "@/components/choose-plan-client"

export default function ChoosePlanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ChoosePlanClient />
    </Suspense>
  )
}

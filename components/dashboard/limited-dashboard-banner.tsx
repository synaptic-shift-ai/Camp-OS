"use client"

import { AlertCircle, ArrowRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface LimitedDashboardBannerProps {
  incompleteCount: number
  onCompleteSetup: () => void
}

export function LimitedDashboardBanner({
  incompleteCount,
  onCompleteSetup,
}: LimitedDashboardBannerProps) {
  return (
    <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between gap-4 text-amber-900 dark:text-amber-100">
        <div className="flex-1">
          <p className="font-medium">Property Setup Incomplete</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            {incompleteCount === 1 ? (
              <>You have 1 property that needs configuration before you can accept bookings.</>
            ) : (
              <>You have {incompleteCount} properties that need configuration before you can accept bookings.</>
            )}
          </p>
        </div>
        <Button
          onClick={onCompleteSetup}
          variant="default"
          size="sm"
          className="flex-shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
        >
          Complete Setup
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  )
}

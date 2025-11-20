"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Rocket, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * Shows a success message when setup is completed
 * Triggered by ?setup=complete query parameter
 */
export function SetupCompleteToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (searchParams.get("setup") === "complete") {
      setShow(true)

      // Clean up URL after showing toast
      const params = new URLSearchParams(searchParams)
      params.delete("setup")
      const newUrl = params.toString() ? `?${params.toString()}` : ""
      router.replace(`/dashboard${newUrl}`, { scroll: false })
    }
  }, [searchParams, router])

  const handleDismiss = () => {
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-4">
      <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 shadow-lg min-w-[400px]">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
              <Rocket className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Setup Complete!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your property is now live and ready to accept bookings. You can view your booking page and share it with guests.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

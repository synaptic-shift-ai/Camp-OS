"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Loader2, XCircle, Tent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function PaymentFailureClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sessionId = searchParams.get("session_id")

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session ID")
      setLoading(false)
      return
    }

    // Verify the Stripe session
    fetch(`/api/stripe/verify-session?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          setError("Failed to verify payment")
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to verify payment")
        setLoading(false)
      })
  }, [sessionId])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Confirming your payment...</p>
        </div>
      </div>
    )
  }

  // Error/Failure state
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Tent className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">CampOS</span>
          </div>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 p-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6"
          >
            <XCircle className="w-10 h-10 text-red-500" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white mb-2">Payment Failed</h1>
          <p className="text-gray-400 mb-6">
            {error || "We were unable to process your payment. Please try again or contact support."}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => (window.location.href = "mailto:support@campos.com")}
              className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white"
            >
              Contact Support
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/choose-plan")}
              className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-white"
            >
              Back to Plans
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

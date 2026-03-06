"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Mail, Loader2, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "That verification link is invalid. Please request a new one.",
  expired: "That verification link has expired. Please request a new one.",
  failed: "Something went wrong confirming your email. Please try again.",
}

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState<string>("")
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const isConfirmed = searchParams.get("confirmed") === "true"
  const linkError = searchParams.get("error")
  const redirect = searchParams.get("redirect")

  useEffect(() => {
    const init = async () => {
      if (isConfirmed) {
        await supabase.auth.refreshSession()
        setConfirmed(true)
        setTimeout(() => {
          router.push(redirect || "/company-details")
        }, 1500)
        return
      }

      if (linkError && ERROR_MESSAGES[linkError]) {
        setError(ERROR_MESSAGES[linkError])
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setEmail(user.email)
      }
      if (user?.app_metadata?.custom_email_verified) {
        router.push(redirect || "/company-details")
      }
    }
    init()
  }, [supabase, router, isConfirmed, linkError, redirect])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleResend = async () => {
    setResending(true)
    setResent(false)
    setError(null)

    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to send verification email")
        setResending(false)
        return
      }

      setResent(true)
      setCooldown(60)
    } catch {
      setError("Failed to send verification email. Please try again.")
    } finally {
      setResending(false)
    }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 rounded-lg p-8 border border-zinc-800 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
          <p className="text-gray-400">Redirecting you now...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-lg p-8 border border-zinc-800">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
            <Mail className="w-10 h-10 text-blue-500" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Check your email
          </h1>

          <p className="text-gray-400 mb-6">
            We sent a verification link to
          </p>

          {email && (
            <div className="mb-6 p-3 bg-zinc-800 rounded-lg border border-zinc-700">
              <p className="text-white font-medium text-sm">{email}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-400 text-left">{error}</p>
            </div>
          )}

          <div className="space-y-3 mb-6">
            <p className="text-sm text-gray-400">
              Click the link in the email to verify your address. Check your spam folder if you don&apos;t see it.
            </p>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-900 text-gray-500">
                didn&apos;t receive it?
              </span>
            </div>
          </div>

          <Button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="w-full h-11 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium"
          >
            {resending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : cooldown > 0 ? (
              `Resend email in ${cooldown}s`
            ) : (
              "Resend Verification Email"
            )}
          </Button>

          {resent && (
            <p className="text-sm text-emerald-400 mt-3">
              New verification email sent! Check your inbox.
            </p>
          )}

          <div className="mt-8 pt-6 border-t border-zinc-800">
            <Button
              onClick={() => router.push("/signup")}
              variant="ghost"
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign Up
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}

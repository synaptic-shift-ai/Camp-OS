"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Mail, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [email, setEmail] = useState<string>("")
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setEmail(user.email)
      }
    }
    getUser()
  }, [supabase])

  const handleResendEmail = async () => {
    setResending(true)
    setResent(false)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) {
        console.error('Failed to resend verification email:', error)
      } else {
        setResent(true)
      }
    } catch (err) {
      console.error('Error resending email:', err)
    } finally {
      setResending(false)
    }
  }

  const handleCheckVerification = async () => {
    setChecking(true)

    try {
      // Refresh the user session to get latest email_confirmed_at
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        console.error('Failed to check verification:', error)
        setChecking(false)
        return
      }

      if (user?.email_confirmed_at) {
        // Email is verified! Redirect to where they were trying to go
        const redirect = searchParams.get('redirect')
        router.push(redirect || '/dashboard')
      } else {
        // Not verified yet
        alert('Email not verified yet. Please check your inbox and click the verification link.')
        setChecking(false)
      }
    } catch (err) {
      console.error('Error checking verification:', err)
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-lg p-8 border border-zinc-800">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
            <Mail className="w-10 h-10 text-blue-500" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Verify Your Email
          </h1>

          <p className="text-gray-400 mb-6">
            To access your dashboard, please verify your email address.
          </p>

          {email && (
            <div className="mb-6 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
              <p className="text-sm text-gray-400 mb-1">Verification email sent to:</p>
              <p className="text-white font-medium">{email}</p>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Check your inbox and click the verification link. Once verified, click the button below to continue.
            </p>

            <Button
              onClick={handleCheckVerification}
              disabled={checking}
              className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium"
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  I've Verified My Email
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-zinc-900 text-gray-500">or</span>
              </div>
            </div>

            <Button
              onClick={handleResendEmail}
              disabled={resending}
              variant="outline"
              className="w-full bg-transparent border-zinc-700 hover:bg-zinc-800 text-white"
            >
              {resending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Resend Verification Email"
              )}
            </Button>

            {resent && (
              <p className="text-sm text-emerald-400">
                Verification email sent! Check your inbox.
              </p>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800">
            <p className="text-sm text-gray-400 mb-4">
              Need help? Contact support at{" "}
              <a href="mailto:support@campos.com" className="text-red-500 hover:text-red-400">
                support@campos.com
              </a>
            </p>
            <Button
              onClick={() => router.push('/choose-plan')}
              variant="ghost"
              className="text-gray-400 hover:text-white"
            >
              Back to Plan Selection
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
